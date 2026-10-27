"""Leave and Permission Request Management API Router."""

from datetime import datetime, timezone
import logging
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy import func
from sqlalchemy.orm import Session, joinedload

from backend.app.api.deps import get_current_user, get_db, require_hr_or_admin
from backend.app.api.v1.ws import ws_manager
from backend.app.core.security import CurrentUser, UserRole
from backend.app.models.leave import LeaveRequest
from backend.app.models.user import User
from backend.app.schemas.leave import (
    LeaveActionEnum,
    LeaveCreate,
    LeaveEnquiryReply,
    LeaveOut,
    LeaveReviewAction,
    LeaveStatusEnum,
)

logger = logging.getLogger("smart_attendance.leaves")

router = APIRouter(prefix="/leaves", tags=["Leaves & Permissions"])


def _format_leave_out(req: LeaveRequest) -> LeaveOut:
    """Safely format a LeaveRequest model into LeaveOut response."""
    emp_id = req.user.employee_id if req.user else "N/A"
    full_name = req.user.full_name if req.user else "Unknown Employee"
    dept_name = req.user.department.name if req.user and req.user.department else None
    reviewer_name = req.reviewer.full_name if req.reviewer else None

    return LeaveOut(
        id=req.id,
        user_id=req.user_id,
        employee_id=emp_id,
        employee_code=emp_id,
        full_name=full_name,
        employee_name=full_name,
        department_name=dept_name,
        request_type=req.request_type,
        leave_type=req.leave_type,
        start_date=req.start_date,
        end_date=req.end_date,
        start_time=req.start_time,
        end_time=req.end_time,
        duration_hours=req.duration_hours,
        reason=req.reason,
        status=req.status,
        reviewer_id=req.reviewer_id,
        reviewer_name=reviewer_name,
        admin_notes=req.admin_notes,
        employee_reply=req.employee_reply,
        created_at=req.created_at,
        updated_at=req.updated_at,
    )


@router.post("/", response_model=LeaveOut, status_code=status.HTTP_201_CREATED)
async def submit_leave_request(
    leave_in: LeaveCreate,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Submit a new Leave or Permission request (Employee or Staff)."""
    end_date_val = leave_in.end_date or leave_in.start_date
    if end_date_val < leave_in.start_date:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="End date cannot be earlier than start date.",
        )

    new_request = LeaveRequest(
        user_id=current_user.id,
        request_type=leave_in.request_type.upper(),
        leave_type=leave_in.leave_type.upper(),
        start_date=leave_in.start_date,
        end_date=end_date_val,
        start_time=leave_in.start_time,
        end_time=leave_in.end_time,
        duration_hours=leave_in.duration_hours,
        reason=leave_in.reason.strip(),
        status=LeaveStatusEnum.PENDING.value,
    )

    db.add(new_request)
    db.commit()
    db.refresh(new_request)

    # Load relationship for response
    refreshed = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.id == new_request.id)
        .first()
    )

    out = _format_leave_out(refreshed or new_request)

    # Broadcast real-time event to Admin and HR dashboards
    try:
        await ws_manager.broadcast_leave_event({
            "action": "CREATED",
            "leave": out.model_dump(mode="json"),
        })
    except Exception as e:
        logger.warning(f"Could not broadcast leave event: {e}")

    return out


@router.get("/my-requests", response_model=List[LeaveOut])
def get_my_leave_requests(
    employee_id: Optional[str] = Query(None, description="Target employee ID"),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Retrieve all leave and permission requests for the authenticated user."""
    target_user_id = current_user.id
    if employee_id and employee_id.strip():
        req_id = employee_id.strip()
        if (
            current_user.role == UserRole.EMPLOYEE.value
            and current_user.employee_id.lower() != req_id.lower()
        ):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied: Cannot query another employee's leave requests.",
            )
        u = db.query(User).filter(func.lower(User.employee_id) == req_id.lower()).first()
        if u:
            target_user_id = u.id

    requests = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.user_id == target_user_id)
        .order_by(LeaveRequest.created_at.desc())
        .all()
    )

    return [_format_leave_out(r) for r in requests]


@router.put("/my-requests/{request_id}/reply", response_model=LeaveOut)
async def reply_to_enquiry(
    request_id: int,
    enquiry_reply: LeaveEnquiryReply,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Employee response to an Admin/HR enquiry on their leave request."""
    req = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.id == request_id, LeaveRequest.user_id == current_user.id)
        .first()
    )

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    req.employee_reply = enquiry_reply.reply.strip()
    req.status = LeaveStatusEnum.PENDING.value  # Revert back to Pending for review
    req.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(req)

    out = _format_leave_out(req)

    try:
        await ws_manager.broadcast_leave_event({
            "action": "ENQUIRY_REPLIED",
            "leave": out.model_dump(mode="json"),
        })
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")

    return out


@router.post("/my-requests/{request_id}/cancel", response_model=LeaveOut)
async def cancel_my_leave_request(
    request_id: int,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(get_current_user),
):
    """Cancel a pending leave or permission request submitted by the employee."""
    req = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.id == request_id, LeaveRequest.user_id == current_user.id)
        .first()
    )

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    if req.status not in (LeaveStatusEnum.PENDING.value, LeaveStatusEnum.ENQUIRY_REQUESTED.value):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Cannot cancel a request that is already {req.status}.",
        )

    req.status = LeaveStatusEnum.CANCELLED.value
    req.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(req)

    out = _format_leave_out(req)

    try:
        await ws_manager.broadcast_leave_event({
            "action": "CANCELLED",
            "leave": out.model_dump(mode="json"),
        })
    except Exception as e:
        logger.warning(f"WebSocket broadcast error: {e}")

    return out


@router.get("/", response_model=List[LeaveOut])
def list_all_leave_requests(
    status_filter: Optional[str] = Query(None, alias="status"),
    request_type: Optional[str] = Query(None),
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Retrieve all company leave and permission requests (Admin and HR only)."""
    query = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
    )

    if status_filter and status_filter.strip():
        query = query.filter(LeaveRequest.status == status_filter.strip().upper())

    if request_type and request_type.strip():
        query = query.filter(LeaveRequest.request_type == request_type.strip().upper())

    requests = (
        query.order_by(LeaveRequest.created_at.desc())
        .offset(offset)
        .limit(limit)
        .all()
    )

    return [_format_leave_out(r) for r in requests]


@router.get("/pending-count")
def get_pending_leave_count(
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Count pending and enquiry requests for real-time notification badges."""
    pending_count = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == LeaveStatusEnum.PENDING.value)
        .count()
    )
    enquiry_count = (
        db.query(LeaveRequest)
        .filter(LeaveRequest.status == LeaveStatusEnum.ENQUIRY_REQUESTED.value)
        .count()
    )
    total_actionable = pending_count + enquiry_count
    return {
        "pending_count": pending_count,
        "enquiry_count": enquiry_count,
        "total_actionable": total_actionable,
    }


@router.post("/{request_id}/action", response_model=LeaveOut)
async def review_leave_request(
    request_id: int,
    action_in: LeaveReviewAction,
    db: Session = Depends(get_db),
    current_user: CurrentUser = Depends(require_hr_or_admin),
):
    """Approve, Reject, or Enquire on a leave request (Admin/HR only)."""
    req = (
        db.query(LeaveRequest)
        .options(
            joinedload(LeaveRequest.user).joinedload(User.department),
            joinedload(LeaveRequest.reviewer),
        )
        .filter(LeaveRequest.id == request_id)
        .first()
    )

    if not req:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Leave request not found.",
        )

    note_val = (action_in.notes or action_in.admin_notes or "").strip()

    if action_in.action == LeaveActionEnum.APPROVE:
        req.status = LeaveStatusEnum.APPROVED.value
        if note_val:
            req.admin_notes = note_val
    elif action_in.action == LeaveActionEnum.REJECT:
        if not note_val:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="A rejection reason or note is required.",
            )
        req.status = LeaveStatusEnum.REJECTED.value
        req.admin_notes = note_val
    elif action_in.action == LeaveActionEnum.ENQUIRE:
        if not note_val:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Please specify your enquiry question or requested details for the employee.",
            )
        req.status = LeaveStatusEnum.ENQUIRY_REQUESTED.value
        req.admin_notes = note_val

    req.reviewer_id = current_user.id
    req.updated_at = datetime.now(timezone.utc)

    db.commit()
    db.refresh(req)

    out = _format_leave_out(req)

    try:
        await ws_manager.broadcast_leave_event({
            "action": action_in.action.value,
            "leave": out.model_dump(mode="json"),
        })
    except Exception as e:
        logger.warning(f"Could not broadcast leave review event: {e}")

    return out
