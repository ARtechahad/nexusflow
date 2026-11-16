import React, { useState } from 'react';
import { Building2, X, Check, Plus, ArrowRight, AlertCircle } from 'lucide-react';
import { useApp } from '../context/AppContext';

interface TenantOnboardingModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const STARTER_DEPT_PRESETS = ['Operations', 'Engineering', 'Sales', 'Design', 'Support'];

export const TenantOnboardingModal: React.FC<TenantOnboardingModalProps> = ({ isOpen, onClose }) => {
  const { createCompany } = useApp();

  const [companyName, setCompanyName] = useState('');
  const [industry, setIndustry] = useState('Software & Technology');
  const [companySize, setCompanySize] = useState('1-10 employees');
  const [description, setDescription] = useState('');
  const [selectedDepts, setSelectedDepts] = useState<string[]>(['Operations', 'Engineering']);
  const [customDept, setCustomDept] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const toggleDept = (dept: string) => {
    setSelectedDepts((prev) =>
      prev.includes(dept) ? prev.filter((d) => d !== dept) : [...prev, dept]
    );
  };

  const addCustomDept = () => {
    const clean = customDept.trim();
    if (!clean) return;
    if (!selectedDepts.some((d) => d.toLowerCase() === clean.toLowerCase())) {
      setSelectedDepts((prev) => [...prev, clean]);
    }
    setCustomDept('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!companyName.trim() || companyName.trim().length < 2) {
      setError('Company Name must be at least 2 characters.');
      return;
    }

    setSubmitting(true);
    setError(null);
    const res = await createCompany({
      name: companyName.trim(),
      industry,
      size: companySize,
      description: description.trim() || undefined,
      initialDepartments: selectedDepts.length > 0 ? selectedDepts : ['Operations']
    });
    setSubmitting(false);

    if (res.success) {
      setCompanyName('');
      setDescription('');
      onClose();
    } else {
      setError(res.message || 'Could not register new company.');
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-xs overflow-y-auto animate-fadeIn"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-lg bg-[#FFFFFF] dark:bg-[#111827] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden my-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="px-6 py-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-indigo-600 text-white flex items-center justify-center">
              <Building2 className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-base font-bold text-slate-950 dark:text-white tracking-tight">
                Register New Company
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Create an isolated workspace under your personal account
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-slate-800 transition cursor-pointer"
            aria-label="Close Register New Company Modal"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/50 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 text-xs flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Company Name
            </label>
            <input
              id="input-modal-company-name"
              type="text"
              required
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              placeholder="e.g. Horizon Cloud Studio"
              className="w-full px-3.5 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30 focus:border-indigo-500"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Industry
              </label>
              <select
                value={industry}
                onChange={(e) => setIndustry(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="Software & Technology">Software &amp; Technology</option>
                <option value="Digital Agency & Consulting">Digital Agency &amp; Consulting</option>
                <option value="Logistics & Supply Chain">Logistics &amp; Supply Chain</option>
                <option value="Financial Services">Financial Services</option>
                <option value="E-Commerce & Retail">E-Commerce &amp; Retail</option>
                <option value="Other B2B Services">Other B2B Services</option>
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
                Company Size
              </label>
              <select
                value={companySize}
                onChange={(e) => setCompanySize(e.target.value)}
                className="w-full px-3 py-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs font-medium focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
              >
                <option value="1-10 employees">1–10 employees</option>
                <option value="11-50 employees">11–50 employees</option>
                <option value="51-200 employees">51–200 employees</option>
                <option value="200+ employees">200+ employees</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300 mb-1.5">
              Description (Optional)
            </label>
            <input
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief focus of this company..."
              className="w-full px-3.5 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs focus:outline-hidden focus:ring-2 focus:ring-indigo-500/30"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-semibold text-slate-700 dark:text-slate-300">
              Starter Departments
            </label>
            <div className="flex flex-wrap gap-1.5">
              {Array.from(new Set([...STARTER_DEPT_PRESETS, ...selectedDepts])).map((dept) => {
                const active = selectedDepts.includes(dept);
                return (
                  <button
                    key={dept}
                    type="button"
                    onClick={() => toggleDept(dept)}
                    className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                      active
                        ? 'bg-indigo-600 text-white border-indigo-600'
                        : 'bg-[#F8FAFC] dark:bg-[#090D16] text-slate-700 dark:text-slate-300 border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    {active && <Check className="w-3 h-3" />}
                    <span>{dept}</span>
                  </button>
                );
              })}
            </div>

            <div className="flex gap-2 pt-1">
              <input
                type="text"
                value={customDept}
                onChange={(e) => setCustomDept(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addCustomDept();
                  }
                }}
                placeholder="Custom department..."
                className="flex-1 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-[#F8FAFC] dark:bg-[#090D16] text-slate-950 dark:text-white text-xs"
              />
              <button
                type="button"
                onClick={addCustomDept}
                className="btn-tactile-secondary px-3 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add</span>
              </button>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-200 dark:border-slate-800 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-tactile-secondary px-4 py-2 rounded-lg text-xs font-semibold cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              id="btn-modal-create-company"
              disabled={submitting}
              className="btn-tactile-primary px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <span>{submitting ? 'Creating...' : 'Create Company'}</span>
              {!submitting && <ArrowRight className="w-3.5 h-3.5" />}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
