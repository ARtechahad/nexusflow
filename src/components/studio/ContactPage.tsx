import React, { useEffect, useState } from 'react';
import {
  BUDGET_RANGES,
  INQUIRY_CATEGORIES,
  InquiryCategory,
  SOCIAL_CHANNELS,
  STUDIO_BRAND
} from '../../data/studioData';

interface FormState {
  name: string;
  email: string;
  company: string;
  category: InquiryCategory;
  budget: string;
  message: string;
  honeypot: string;
}

export const ContactPage: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    name: '',
    email: '',
    company: '',
    category: 'Web / Mobile App',
    budget: '',
    message: '',
    honeypot: ''
  });

  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [fallbackMailto, setFallbackMailto] = useState<string | null>(null);
  const [attachedBlueprintTitle, setAttachedBlueprintTitle] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const paramCategory = params.get('category');
    const paramService = params.get('service');
    const paramBlueprint = params.get('blueprint');

    if (
      paramCategory &&
      (INQUIRY_CATEGORIES as readonly string[]).includes(paramCategory)
    ) {
      setForm((prev) => ({
        ...prev,
        category: paramCategory as InquiryCategory
      }));
    }

    if (paramBlueprint && paramBlueprint.trim().length > 0) {
      setAttachedBlueprintTitle(paramService || 'Configured Technical Blueprint');
      setForm((prev) => {
        if (prev.message.trim().length > 0) {
          return prev;
        }
        return {
          ...prev,
          message: `${paramBlueprint.trim()}\n\nAdditional project context / target launch date:\n`
        };
      });
    }
  }, []);

  const buildFallbackMailto = () => {
    const subject = `[almnexus.tech] [${form.category}] ${form.company.trim() || form.name.trim() || 'Project Inquiry'}`;
    const body = [
      `Name: ${form.name.trim()}`,
      `Email: ${form.email.trim()}`,
      `Company: ${form.company.trim() || 'Not specified'}`,
      `Category: ${form.category}`,
      `Budget: ${form.budget || 'Not specified'}`,
      '',
      form.message.trim()
    ].join('\n');
    return `mailto:${STUDIO_BRAND.emailPrimary}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);
    setFallbackMailto(null);

    const name = form.name.trim();
    const email = form.email.trim();
    const message = form.message.trim();

    if (name.length < 2) {
      setErrorMessage('Please enter your name (at least 2 characters).');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setErrorMessage('Please enter a valid email address.');
      return;
    }
    if (message.length < 10) {
      setErrorMessage('Please describe what you want built (at least 10 characters).');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch('/api/inquiry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          email,
          company: form.company.trim(),
          category: form.category,
          focus: form.category,
          budget: form.budget,
          message,
          notes: message,
          honeypot: form.honeypot,
          source: 'contact_page'
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data?.success) {
        setErrorMessage(
          data?.error ||
            `Could not send inquiry automatically. You can email ${STUDIO_BRAND.emailPrimary} directly.`
        );
        setFallbackMailto(buildFallbackMailto());
        return;
      }

      if (data.deliveryMode === 'mailto_fallback' && data.fallbackMailto) {
        setFallbackMailto(data.fallbackMailto);
      }

      setSuccessMessage(
        data.message ||
          `Inquiry received. We will reply from ${STUDIO_BRAND.emailPrimary} within 1-2 business days.`
      );
      setForm({
        name: '',
        email: '',
        company: '',
        category: 'Web / Mobile App',
        budget: '',
        message: '',
        honeypot: ''
      });
    } catch {
      setErrorMessage(
        `Network error while submitting form. Email ${STUDIO_BRAND.emailPrimary} directly using the link below.`
      );
      setFallbackMailto(buildFallbackMailto());
    } finally {
      setSubmitting(false);
    }
  };

  const inputClassName =
    'w-full px-3.5 py-2.5 rounded-[6px] border border-slate-300 dark:border-slate-700 bg-white dark:bg-[#0B0F17] text-slate-900 dark:text-slate-100 text-sm placeholder:text-slate-400 focus:border-[var(--accent)] focus:outline-none';

  return (
    <>
      <section className="py-16 md:py-24 border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-[68ch] space-y-4">
            <h1 className="text-[34px] sm:text-[44px] lg:text-[50px] font-bold tracking-[-0.025em] leading-[1.1] text-slate-900 dark:text-white">
              Start a project
            </h1>
            <p className="text-[16px] sm:text-[17px] leading-[1.6] text-slate-600 dark:text-slate-300">
              Tell us what you want built. We reply within 1-2 business days.
            </p>
          </div>
        </div>
      </section>

      <section className="py-16 md:py-24">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 grid grid-cols-1 lg:grid-cols-12 gap-10">
          <div className="lg:col-span-7">
            <form
              onSubmit={handleSubmit}
              noValidate
              className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-5"
            >
              {attachedBlueprintTitle && (
                <div className="p-3.5 rounded-[6px] border border-blue-200 dark:border-blue-900/60 bg-blue-50/70 dark:bg-blue-950/20 flex items-start justify-between gap-3 text-sm">
                  <div className="space-y-0.5">
                    <div className="font-semibold text-slate-900 dark:text-white">
                      Attached Blueprint: {attachedBlueprintTitle}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-300">
                      Your selected stack, layout, and modules have been pre-filled below.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAttachedBlueprintTitle(null)}
                    className="text-xs font-mono text-slate-500 hover:text-slate-900 dark:hover:text-white cursor-pointer shrink-0"
                  >
                    Dismiss
                  </button>
                </div>
              )}

              {/* Bot honeypot field */}
              <div className="sr-only" aria-hidden="true">
                <label htmlFor="contact-honeypot">Leave this field empty</label>
                <input
                  id="contact-honeypot"
                  name="honeypot"
                  type="text"
                  tabIndex={-1}
                  autoComplete="off"
                  value={form.honeypot}
                  onChange={(e) => setForm((prev) => ({ ...prev, honeypot: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-name"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Name
                  </label>
                  <input
                    id="contact-name"
                    name="name"
                    type="text"
                    required
                    autoComplete="name"
                    value={form.name}
                    onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
                    placeholder="Your name"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-email"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Email
                  </label>
                  <input
                    id="contact-email"
                    name="email"
                    type="email"
                    required
                    autoComplete="email"
                    value={form.email}
                    onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
                    placeholder="you@company.com"
                    className={inputClassName}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-company"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Company <span className="text-slate-500 font-normal">(optional)</span>
                  </label>
                  <input
                    id="contact-company"
                    name="company"
                    type="text"
                    autoComplete="organization"
                    value={form.company}
                    onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
                    placeholder="Company or URL"
                    className={inputClassName}
                  />
                </div>

                <div className="space-y-1.5">
                  <label
                    htmlFor="contact-category"
                    className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                  >
                    Project category
                  </label>
                  <select
                    id="contact-category"
                    name="category"
                    value={form.category}
                    onChange={(e) =>
                      setForm((prev) => ({
                        ...prev,
                        category: e.target.value as InquiryCategory
                      }))
                    }
                    className={inputClassName}
                  >
                    {INQUIRY_CATEGORIES.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="contact-budget"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Budget range <span className="text-slate-500 font-normal">(optional)</span>
                </label>
                <select
                  id="contact-budget"
                  name="budget"
                  value={form.budget}
                  onChange={(e) => setForm((prev) => ({ ...prev, budget: e.target.value }))}
                  className={inputClassName}
                >
                  <option value="">Select budget range</option>
                  {BUDGET_RANGES.map((range) => (
                    <option key={range} value={range}>
                      {range}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label
                  htmlFor="contact-message"
                  className="block text-sm font-medium text-slate-900 dark:text-slate-100"
                >
                  Project details
                </label>
                <textarea
                  id="contact-message"
                  name="message"
                  required
                  rows={5}
                  value={form.message}
                  onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
                  placeholder="Describe the product, timeline, or workflow you want built."
                  className={inputClassName}
                />
              </div>

              {errorMessage && (
                <div
                  role="alert"
                  className="p-3.5 rounded-[6px] border border-red-300 dark:border-red-800 bg-red-50 dark:bg-red-950/40 text-sm text-red-800 dark:text-red-200 space-y-2"
                >
                  <p>{errorMessage}</p>
                  <p>
                    Fallback email:{' '}
                    <a
                      href={fallbackMailto || `mailto:${STUDIO_BRAND.emailPrimary}`}
                      className="font-mono underline font-medium"
                    >
                      {STUDIO_BRAND.emailPrimary}
                    </a>
                  </p>
                </div>
              )}

              {successMessage && (
                <div
                  role="status"
                  className="p-3.5 rounded-[6px] border border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-sm text-emerald-900 dark:text-emerald-200 space-y-2"
                >
                  <p>{successMessage}</p>
                  {fallbackMailto && (
                    <p>
                      <a href={fallbackMailto} className="font-mono underline font-medium">
                        Open pre-filled email to {STUDIO_BRAND.emailPrimary}
                      </a>
                    </p>
                  )}
                </div>
              )}

              <div className="pt-1">
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 rounded-[6px] text-sm font-medium bg-[var(--accent)] hover:bg-[#1D4ED8] disabled:opacity-60 disabled:cursor-not-allowed text-white transition-colors cursor-pointer"
                >
                  {submitting ? 'Sending inquiry...' : 'Send project inquiry'}
                </button>
              </div>
            </form>
          </div>

          <aside className="lg:col-span-5 space-y-6">
            <div className="p-6 sm:p-8 rounded-[8px] border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111827] space-y-6">
              <div className="space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Direct email
                </h2>
                <ul className="space-y-1.5 text-sm font-mono">
                  <li>
                    <a
                      href={`mailto:${STUDIO_BRAND.emailPrimary}`}
                      className="text-slate-900 dark:text-slate-100 underline"
                    >
                      {STUDIO_BRAND.emailPrimary}
                    </a>
                  </li>
                  <li>
                    <a
                      href={`mailto:${STUDIO_BRAND.emailDirect}`}
                      className="text-slate-600 dark:text-slate-300 hover:underline"
                    >
                      {STUDIO_BRAND.emailDirect}
                    </a>
                  </li>
                </ul>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Availability
                </h2>
                <p className="text-sm leading-[1.6] text-slate-600 dark:text-slate-300">
                  {STUDIO_BRAND.contactAvailability}
                </p>
              </div>

              <div className="pt-5 border-t border-slate-200 dark:border-slate-800 space-y-2">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">
                  Social links
                </h2>
                <ul className="flex flex-wrap gap-x-5 gap-y-2 text-sm">
                  {SOCIAL_CHANNELS.map((channel) => (
                    <li key={channel.name}>
                      <a
                        href={channel.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-slate-700 dark:text-slate-300 hover:text-[var(--accent)] dark:hover:text-blue-400 underline underline-offset-4"
                      >
                        {channel.name}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </aside>
        </div>
      </section>
    </>
  );
};
