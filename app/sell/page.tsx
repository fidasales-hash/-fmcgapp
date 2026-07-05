'use client';
import { useState } from 'react';

export default function SellPage() {
  const [businessName, setBusinessName] = useState('');
  const [contactName, setContactName] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    if (!businessName.trim()) return setError('Business name is required');
    if (!phone.trim()) return setError('Phone number is required');

    setSubmitting(true);
    try {
      const res = await fetch('/api/sellers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ businessName, contactName, phone, email }),
      });
      if (res.ok) {
        setSuccess(true);
      } else {
        const data = await res.json();
        setError(data.error ?? 'Something went wrong — please try again');
      }
    } catch {
      setError('Network error — please try again');
    }
    setSubmitting(false);
  }

  if (success) {
    return (
      <main className="success-screen">
        <div className="success-icon">✓</div>
        <h2>Application received!</h2>
        <p style={{ color: 'var(--muted)', marginBottom: '1.5rem' }}>
          We&apos;ll review your details and be in touch to confirm your seller account.
        </p>
        <a href="/" className="btn-secondary">Back to Store</a>
      </main>
    );
  }

  return (
    <main className="upload-page">
      <h1>Become a Seller</h1>
      <p style={{ color: 'var(--muted)', fontSize: '0.9rem', marginBottom: '1.25rem' }}>
        List your own products on our storefront. Tell us about your business and we&apos;ll be in touch.
      </p>

      {error && <p className="error">{error}</p>}

      <form onSubmit={handleSubmit}>
        <div className="field-wrap">
          <label className="field-label">Business name *</label>
          <input className="field" value={businessName} onChange={e => setBusinessName(e.target.value)} placeholder="e.g. Acme Wholesale" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Contact name</label>
          <input className="field" value={contactName} onChange={e => setContactName(e.target.value)} placeholder="Your name" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Phone *</label>
          <input className="field" value={phone} onChange={e => setPhone(e.target.value)} placeholder="e.g. 082 123 4567" inputMode="tel" />
        </div>
        <div className="field-wrap">
          <label className="field-label">Email</label>
          <input className="field" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
        </div>

        <button type="submit" className="btn-primary" disabled={submitting}>
          {submitting ? 'Submitting…' : 'Submit Application'}
        </button>
      </form>
      <a href="/" className="btn-secondary" style={{ marginTop: '0.75rem' }}>← Back to Store</a>
    </main>
  );
}
