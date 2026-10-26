import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Users,
  UserPlus,
  Search,
  Building,
  CheckCircle,
  Camera,
  Shield,
  Trash2,
  X,
  AlertCircle,
  Scan,
  RefreshCw,
} from 'lucide-react';
import api from '../services/api';
import { Department, User, UserCreate } from '../types';
import { playChime } from './Toast';

interface EmployeesProps {
  onNotify?: (toast: { type: 'success' | 'error' | 'warning' | 'info'; title: string; message: string }) => void;
}

export const Employees: React.FC<EmployeesProps> = ({ onNotify }) => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [search, setSearch] = useState<string>('');
  const [deptFilter, setDeptFilter] = useState<number | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);

  // Modals state
  const [showAddModal, setShowAddModal] = useState<boolean>(false);
  const [showEnrollModal, setShowEnrollModal] = useState<boolean>(false);
  const [selectedUserForEnroll, setSelectedUserForEnroll] = useState<User | null>(null);

  // Add Employee Form State
  const [addForm, setAddForm] = useState<UserCreate>({
    employee_id: '',
    full_name: '',
    email: '',
    password: '',
    role: 'EMPLOYEE',
    department_id: undefined,
    shift_start: '09:15',
    is_active: true,
  });
  const [submittingAdd, setSubmittingAdd] = useState<boolean>(false);

  // Face Enrollment Camera State
  const enrollVideoRef = useRef<HTMLVideoElement | null>(null);
  const enrollCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const [enrollStreamActive, setEnrollStreamActive] = useState<boolean>(false);
  const [capturedSnapshot, setCapturedSnapshot] = useState<string | null>(null);
  const [enrollingFace, setEnrollingFace] = useState<boolean>(false);

  // Fetch Employees and Departments
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [empList, deptList] = await Promise.all([
        api.listEmployees({
          department_id: deptFilter,
          search: search.trim() ? search : undefined,
        }),
        api.listDepartments(),
      ]);
      setEmployees(empList);
      setDepartments(deptList);
    } catch (err: unknown) {
      console.error('Failed to load employee directory:', err);
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Data Load Failed',
          message: 'Could not load corporate employees directory.',
        });
      }
    } finally {
      setLoading(false);
    }
  }, [deptFilter, search, onNotify]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle Add Employee Submit
  const handleAddEmployeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.employee_id || !addForm.full_name || !addForm.email || !addForm.password) {
      if (onNotify) {
        onNotify({
          type: 'warning',
          title: 'Validation Error',
          message: 'Please fill in all required fields.',
        });
      }
      return;
    }

    setSubmittingAdd(true);
    try {
      const newUser = await api.createEmployee({
        ...addForm,
        department_id: addForm.department_id ? Number(addForm.department_id) : undefined,
      });

      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Employee Registered',
          message: `${newUser.full_name} (${newUser.employee_id}) has been added successfully.`,
        });
      }

      setShowAddModal(false);
      setAddForm({
        employee_id: '',
        full_name: '',
        email: '',
        password: '',
        role: 'EMPLOYEE',
        department_id: undefined,
        shift_start: '09:15',
        is_active: true,
      });
      loadData();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Failed to create employee.';
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Registration Error',
          message: errMsg,
        });
      }
    } finally {
      setSubmittingAdd(false);
    }
  };

  // Start Enrollment Camera
  const startEnrollCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 640 } },
        audio: false,
      });
      if (enrollVideoRef.current) {
        enrollVideoRef.current.srcObject = stream;
        enrollVideoRef.current.play();
      }
      setEnrollStreamActive(true);
    } catch (err) {
      console.error('Enrollment camera error:', err);
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Camera Access Error',
          message: 'Could not access web camera for biometric enrollment.',
        });
      }
    }
  };

  // Stop Enrollment Camera
  const stopEnrollCamera = () => {
    if (enrollVideoRef.current && enrollVideoRef.current.srcObject) {
      const stream = enrollVideoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      enrollVideoRef.current.srcObject = null;
    }
    setEnrollStreamActive(false);
  };

  // Open Face Enrollment Modal
  const openEnrollModal = (user: User) => {
    setSelectedUserForEnroll(user);
    setCapturedSnapshot(null);
    setShowEnrollModal(true);
    setTimeout(() => {
      startEnrollCamera();
    }, 150);
  };

  // Close Face Enrollment Modal
  const closeEnrollModal = () => {
    stopEnrollCamera();
    setShowEnrollModal(false);
    setSelectedUserForEnroll(null);
    setCapturedSnapshot(null);
  };

  // Capture Snapshot Frame
  const takeSnapshot = () => {
    if (!enrollVideoRef.current) return;
    const video = enrollVideoRef.current;
    let canvas = enrollCanvasRef.current;
    if (!canvas) {
      canvas = document.createElement('canvas');
      enrollCanvasRef.current = canvas;
    }

    canvas.width = video.videoWidth || 480;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.9);
    setCapturedSnapshot(dataUrl);
    playChime('info');
  };

  // Retake Snapshot
  const retakeSnapshot = () => {
    setCapturedSnapshot(null);
    if (!enrollStreamActive) {
      startEnrollCamera();
    }
  };

  // Submit Biometric Enrollment
  const submitBiometricEnrollment = async () => {
    if (!selectedUserForEnroll || !capturedSnapshot) return;

    setEnrollingFace(true);
    try {
      await api.enrollFace({
        employee_id: selectedUserForEnroll.employee_id,
        image_base64: capturedSnapshot,
      });

      playChime('success');
      if (onNotify) {
        onNotify({
          type: 'success',
          title: 'Biometrics Enrolled',
          message: `Facial vectors encrypted and stored for ${selectedUserForEnroll.full_name}.`,
        });
      }

      closeEnrollModal();
      loadData();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Biometric enrollment failed.';
      playChime('error');
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Enrollment Rejected',
          message: errMsg,
        });
      }
    } finally {
      setEnrollingFace(false);
    }
  };

  // Delete employee handler
  const handleDeleteEmployee = async (user: User) => {
    if (!window.confirm(`Are you sure you want to delete ${user.full_name} (${user.employee_id})?`)) {
      return;
    }

    try {
      await api.deleteEmployee(user.id);
      if (onNotify) {
        onNotify({
          type: 'info',
          title: 'Employee Deleted',
          message: `Employee ${user.full_name} was removed from the database.`,
        });
      }
      loadData();
    } catch (err: unknown) {
      const errMsg = (err as { response?: { data?: { detail?: string } } }).response?.data?.detail || 'Delete failed.';
      if (onNotify) {
        onNotify({
          type: 'error',
          title: 'Action Denied',
          message: errMsg,
        });
      }
    }
  };

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto space-y-6">
      {/* Directory Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-xl">
        <div>
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-emerald-400" />
            <h1 className="text-xl font-bold text-white tracking-tight">Corporate Employee Directory</h1>
          </div>
          <p className="text-xs text-slate-400 mt-1">Manage corporate staff, shift schedules, and facial biometric enrollment</p>
        </div>

        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center justify-center space-x-2 px-4 py-2.5 bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white rounded-xl text-xs font-semibold uppercase tracking-wider transition-all shadow-lg shadow-emerald-950/40"
        >
          <UserPlus className="w-4 h-4" />
          <span>Add Employee</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800">
        <div className="flex-1 relative">
          <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            placeholder="Search by employee name, ID, or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-850 border border-slate-700/80 rounded-xl pl-10 pr-4 py-2 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-emerald-500"
          />
        </div>

        <div className="flex items-center space-x-2">
          <Building className="w-4 h-4 text-slate-400 ml-1" />
          <select
            value={deptFilter === undefined ? '' : deptFilter}
            onChange={(e) => setDeptFilter(e.target.value ? Number(e.target.value) : undefined)}
            className="bg-slate-850 text-slate-200 text-xs px-3 py-2 rounded-xl border border-slate-700/80 focus:outline-none focus:border-emerald-500"
          >
            <option value="">All Departments</option>
            {departments.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} ({d.code})
              </option>
            ))}
          </select>

          <button
            onClick={loadData}
            disabled={loading}
            className="p-2 bg-slate-850 border border-slate-700/80 rounded-xl text-slate-300 hover:text-white transition-colors"
            title="Refresh Table"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-emerald-400' : ''}`} />
          </button>
        </div>
      </div>

      {/* Employees Table */}
      <div className="bg-slate-900 rounded-2xl border border-slate-800 shadow-xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-850/80 text-slate-400 text-xs font-semibold uppercase tracking-wider">
                <th className="py-3.5 px-5">Employee</th>
                <th className="py-3.5 px-5">Department</th>
                <th className="py-3.5 px-5">Role</th>
                <th className="py-3.5 px-5">Shift Start</th>
                <th className="py-3.5 px-5">Biometrics</th>
                <th className="py-3.5 px-5">Status</th>
                <th className="py-3.5 px-5 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-xs text-slate-300">
              {employees.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    No employees found matching filter criteria.
                  </td>
                </tr>
              ) : (
                employees.map((emp) => (
                  <tr key={emp.id} className="hover:bg-slate-850/50 transition-colors">
                    <td className="py-4 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-9 h-9 rounded-xl bg-slate-800 border border-slate-700 flex items-center justify-center font-bold text-slate-200">
                          {emp.full_name
                            .split(' ')
                            .map((n) => n[0])
                            .join('')
                            .slice(0, 2)
                            .toUpperCase()}
                        </div>
                        <div>
                          <div className="font-semibold text-slate-100">{emp.full_name}</div>
                          <div className="text-[11px] font-mono text-slate-400">{emp.email}</div>
                          <div className="text-[10px] font-mono text-emerald-400/90">{emp.employee_id}</div>
                        </div>
                      </div>
                    </td>

                    <td className="py-4 px-5">
                      {emp.department ? (
                        <div>
                          <span className="font-medium text-slate-200">{emp.department.name}</span>
                          <span className="block text-[10px] font-mono text-slate-400">{emp.department.code}</span>
                        </div>
                      ) : (
                        <span className="text-slate-500">General</span>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-semibold uppercase bg-slate-800 text-slate-300 border border-slate-700">
                        {emp.role}
                      </span>
                    </td>

                    <td className="py-4 px-5 font-mono text-slate-300">
                      {emp.shift_start || '09:15'}
                    </td>

                    <td className="py-4 px-5">
                      {emp.has_face_enrolled ? (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-emerald-950/80 text-emerald-300 border border-emerald-800/80">
                          <CheckCircle className="w-3 h-3 text-emerald-400" />
                          <span>Enrolled</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-full text-[10px] font-semibold uppercase tracking-wider bg-amber-950/80 text-amber-300 border border-amber-800/80">
                          <AlertCircle className="w-3 h-3 text-amber-400" />
                          <span>Pending</span>
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5">
                      {emp.is_active ? (
                        <span className="inline-flex items-center text-[11px] text-emerald-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5"></span>
                          Active
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[11px] text-rose-400">
                          <span className="w-1.5 h-1.5 rounded-full bg-rose-400 mr-1.5"></span>
                          Inactive
                        </span>
                      )}
                    </td>

                    <td className="py-4 px-5 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button
                          onClick={() => openEnrollModal(emp)}
                          className="flex items-center space-x-1 px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 hover:bg-emerald-950 text-slate-300 hover:text-emerald-400 border border-slate-700 hover:border-emerald-700 transition-colors"
                          title="Enroll Facial Biometrics"
                        >
                          <Camera className="w-3.5 h-3.5" />
                          <span>{emp.has_face_enrolled ? 'Re-Enroll' : 'Enroll Face'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteEmployee(emp)}
                          className="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-slate-800 transition-colors"
                          title="Delete Employee"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal: Add Employee */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative">
            <button
              onClick={() => setShowAddModal(false)}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-4">
              <UserPlus className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Register Corporate Employee</h2>
            </div>

            <form onSubmit={handleAddEmployeeSubmit} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Employee ID *</label>
                  <input
                    type="text"
                    required
                    placeholder="EMP105"
                    value={addForm.employee_id}
                    onChange={(e) => setAddForm({ ...addForm, employee_id: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Full Name *</label>
                  <input
                    type="text"
                    required
                    placeholder="Jane Doe"
                    value={addForm.full_name}
                    onChange={(e) => setAddForm({ ...addForm, full_name: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Email *</label>
                  <input
                    type="email"
                    required
                    placeholder="jane.doe@enterprise.corp"
                    value={addForm.email}
                    onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Password *</label>
                  <input
                    type="password"
                    required
                    placeholder="••••••••"
                    value={addForm.password}
                    onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Department</label>
                  <select
                    value={addForm.department_id || ''}
                    onChange={(e) => setAddForm({ ...addForm, department_id: e.target.value ? Number(e.target.value) : undefined })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Role</label>
                  <select
                    value={addForm.role}
                    onChange={(e) => setAddForm({ ...addForm, role: e.target.value })}
                    className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500"
                  >
                    <option value="EMPLOYEE">Employee</option>
                    <option value="MANAGER">Manager</option>
                    <option value="HR">HR Specialist</option>
                    <option value="ADMIN">System Admin</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-300 uppercase mb-1">Shift Start Cutoff</label>
                <input
                  type="time"
                  value={addForm.shift_start}
                  onChange={(e) => setAddForm({ ...addForm, shift_start: e.target.value })}
                  className="w-full bg-slate-850 border border-slate-700 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-emerald-500 font-mono"
                />
                <span className="text-[10px] text-slate-500 mt-1 block">Check-ins after this time flag late arrival.</span>
              </div>

              <div className="flex items-center justify-end space-x-3 pt-3 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setShowAddModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-400 hover:text-white"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingAdd}
                  className="px-5 py-2 rounded-xl text-xs font-semibold uppercase tracking-wider bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg transition-all"
                >
                  {submittingAdd ? 'Registering...' : 'Save Employee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Live Biometric Face Enrollment */}
      {showEnrollModal && selectedUserForEnroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/85 backdrop-blur-md animate-in fade-in duration-200">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl max-w-lg w-full p-6 shadow-2xl relative flex flex-col items-center">
            <button
              onClick={closeEnrollModal}
              className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2 mb-2">
              <Scan className="w-5 h-5 text-emerald-400" />
              <h2 className="text-base font-bold text-white">Enroll Facial Biometrics</h2>
            </div>
            <p className="text-xs text-slate-400 text-center mb-4">
              Enrolling <strong className="text-emerald-400">{selectedUserForEnroll.full_name}</strong> ({selectedUserForEnroll.employee_id})
            </p>

            {/* Webcam / Snapshot Viewport */}
            <div className="w-72 h-72 sm:w-80 sm:h-80 bg-black rounded-3xl overflow-hidden relative border-2 border-emerald-500/50 flex items-center justify-center shadow-inner">
              {!capturedSnapshot ? (
                <>
                  <video
                    ref={enrollVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform -scale-x-100"
                  />
                  {/* Portrait Oval Guide */}
                  <div className="absolute inset-4 border-2 border-dashed border-emerald-400/60 rounded-full pointer-events-none flex items-center justify-center">
                    <span className="text-[10px] font-mono text-emerald-300 bg-slate-950/80 px-2.5 py-0.5 rounded-full border border-emerald-800">
                      Center Face in Oval
                    </span>
                  </div>
                </>
              ) : (
                <img
                  src={capturedSnapshot}
                  alt="Captured Portrait"
                  className="w-full h-full object-cover transform -scale-x-100"
                />
              )}
            </div>

            {/* Modal Controls */}
            <div className="mt-5 flex items-center space-x-3">
              {!capturedSnapshot ? (
                <button
                  onClick={takeSnapshot}
                  className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition-all"
                >
                  <Camera className="w-4 h-4" />
                  <span>Capture Snapshot</span>
                </button>
              ) : (
                <>
                  <button
                    onClick={retakeSnapshot}
                    className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 font-semibold text-xs transition-colors border border-slate-700"
                  >
                    Retake Photo
                  </button>

                  <button
                    onClick={submitBiometricEnrollment}
                    disabled={enrollingFace}
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs uppercase tracking-wider shadow-lg shadow-emerald-950/50 transition-all"
                  >
                    <Shield className="w-4 h-4" />
                    <span>{enrollingFace ? 'Encrypting & Saving...' : 'Submit Biometrics'}</span>
                  </button>
                </>
              )}
            </div>

            <div className="mt-4 text-center">
              <span className="text-[10px] text-slate-500 font-mono">
                Encrypted at rest using AES-256-GCM. 512-d unit vector cache updated.
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Employees;
