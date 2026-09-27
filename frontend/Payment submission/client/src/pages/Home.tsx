import { useRef, useState } from "react";
import { RECEIPTS_BUCKET, supabase } from "@/lib/supabase";
import { analyzeReceiptImage } from "@/lib/receiptQuality";
import {
  ArrowUpRight,
  Check,
  CheckCircle2,
  ChevronRight,
  FileImage,
  FileText,
  ImagePlus,
  LockKeyhole,
  Phone,
  RefreshCcw,
  ShieldCheck,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

function formatBytes(bytes: number) {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Home() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [phone, setPhone] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionReference, setSubmissionReference] = useState("BS-2048-091");

  const handleFile = (file?: File) => {
    if (!file) return;
    setError("");
    if (!file.type.startsWith("image/") && file.type !== "application/pdf") {
      setError("Please choose an image or PDF file.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setError("That image is larger than 10 MB. Please choose a smaller file.");
      return;
    }
    setSelectedFile(file);
    setPreviewUrl(URL.createObjectURL(file));
  };

  const clearFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const resetForm = () => {
    clearFile();
    setPhone("");
    setError("");
    setSubmitted(false);
    setIsSubmitting(false);
    setSubmissionReference("BS-2048-091");
  };

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const digits = phone.replace(/\D/g, "");
    if (!selectedFile) {
      setError("Add a payment image to continue.");
      return;
    }
    if (digits.length < 8) {
      setError("Enter a valid phone number with at least 8 digits.");
      return;
    }
    setError("");
    setIsSubmitting(true);
    try {
      if (selectedFile.type !== "application/pdf") {
        const quality = await analyzeReceiptImage(selectedFile);
        if (!quality.ok) {
          setError(quality.message ?? "Please upload a clearer receipt image.");
          return;
        }
      }

      const extension = selectedFile.name.split(".").pop()?.toLowerCase() || (selectedFile.type === "application/pdf" ? "pdf" : "jpg");
      const submissionId = crypto.randomUUID();
      const filePath = `incoming/${submissionId}.${extension}`;
      const { error: uploadError } = await supabase.storage
        .from(RECEIPTS_BUCKET)
        .upload(filePath, selectedFile, { contentType: selectedFile.type, upsert: false });
      if (uploadError) throw uploadError;

      const { error: submissionError } = await supabase.from("payment_submissions").insert({
        id: submissionId,
        phone_number: phone.trim(),
        file_path: filePath,
        file_name: selectedFile.name,
        file_type: selectedFile.type,
        file_size_bytes: selectedFile.size,
        status: "pending",
      });
      if (submissionError) throw submissionError;

      setSubmissionReference(`BS-${submissionId.slice(0, 8).toUpperCase()}`);
      setSubmitted(true);
    } catch (submissionError) {
      console.error("Payment submission failed", submissionError);
      setError("We couldn't submit this receipt right now. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="app-shell">
      <header className="topbar page-width">
        <a className="brand" href="#top" aria-label="BuildStart home">
          <span className="brand-mark"><span /></span>
          <span>buildstart</span>
        </a>
        <div className="topbar-meta">
          <span className="secure-chip"><LockKeyhole size={13} /> Secure intake</span>
          <span className="topbar-divider" aria-hidden="true" />
          <span className="topbar-caption">Payment operations</span>
        </div>
      </header>

      <main id="top" className="page-width main-layout">
        <section className="intro-column" aria-labelledby="page-title">
          <div className="eyebrow"><span className="eyebrow-dot" /> Verification desk <span className="eyebrow-line" /></div>
          <h1 id="page-title">Make every<br /><em>payment</em> traceable.</h1>
          <p className="intro-copy">
            Share your payment receipt and a phone number. Our team will match the details and get back to you shortly.
          </p>

          <div className="assurance-list" aria-label="Verification benefits">
            <div className="assurance-item">
              <span className="assurance-icon"><ShieldCheck size={18} /></span>
              <div><strong>Handled with care</strong><span>Your information stays private.</span></div>
            </div>
            <div className="assurance-item">
              <span className="assurance-icon"><Sparkles size={18} /></span>
              <div><strong>Fast human review</strong><span>Most submissions are checked within a day.</span></div>
            </div>
          </div>

          <div className="intro-footnote"><span>01</span><span className="footnote-rule" /><span>Simple by design</span></div>
        </section>

        <section className="form-card" aria-label="Payment verification form">
          <div className="card-topline"><span>BuildStart / 2026</span><span className="card-status"><span className="status-pulse" /> Online</span></div>
          {!submitted ? (
            <form onSubmit={handleSubmit}>
              <div className="card-heading">
                <span className="step-label">01 <span>/</span> 02</span>
                <h2>Send us the receipt.</h2>
                <p>Upload a clear receipt image or PDF to get started.</p>
              </div>

              <div className="field-group">
                <label htmlFor="payment-receipt">Payment receipt <span>*</span></label>
                <input
                  ref={inputRef}
                  id="payment-receipt"
                  className="sr-only"
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  onChange={(event) => handleFile(event.target.files?.[0])}
                />
                {selectedFile && previewUrl ? (
                  <div className="file-preview">
                    {selectedFile.type === "application/pdf" ? (
                      <div className="pdf-preview"><FileText size={38} /><strong>PDF receipt ready</strong><span>Document selected for review</span></div>
                    ) : (
                      <img src={previewUrl} alt="Selected payment receipt preview" />
                    )}
                    <div className="preview-overlay"><span>Receipt ready</span><button type="button" onClick={clearFile} aria-label="Remove selected image"><X size={16} /></button></div>
                    <div className="preview-meta"><span className="file-icon"><FileImage size={15} /></span><span className="file-name">{selectedFile.name}</span><span className="file-size">{formatBytes(selectedFile.size)}</span></div>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`dropzone ${isDragging ? "is-dragging" : ""}`}
                    onClick={() => inputRef.current?.click()}
                    onDragEnter={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragOver={(event) => { event.preventDefault(); setIsDragging(true); }}
                    onDragLeave={(event) => { event.preventDefault(); setIsDragging(false); }}
                    onDrop={(event) => { event.preventDefault(); setIsDragging(false); handleFile(event.dataTransfer.files?.[0]); }}
                  >
                    <span className="upload-icon"><UploadCloud size={20} /></span>
                    <span className="dropzone-title">Drop your receipt here</span>
                    <span className="dropzone-subtitle">or <u>browse from your device</u></span>
                    <span className="dropzone-hint">JPG, PNG, WEBP, or PDF · max 10 MB</span>
                  </button>
                )}
              </div>

              <div className="field-group phone-field">
                <label htmlFor="phone">Phone number <span>*</span></label>
                <div className="phone-input-wrap"><Phone size={17} /><input id="phone" type="tel" inputMode="tel" value={phone} onChange={(event) => { setPhone(event.target.value); setError(""); }} placeholder="+94 77 123 4567" autoComplete="tel" /></div>
                <p className="field-hint">We’ll use this only to follow up on your verification.</p>
              </div>

              {error && <div className="error-message" role="alert"><span>!</span>{error}</div>}

              <button className="submit-button" type="submit" disabled={isSubmitting}>
                {isSubmitting ? <><RefreshCcw className="spin" size={17} /> Checking details...</> : <>Submit for review <ArrowUpRight size={18} /></>}
              </button>
              <p className="legal-note"><LockKeyhole size={13} /> Your submission is encrypted in transit.</p>
            </form>
          ) : (
            <div className="success-state" role="status">
              <div className="success-orbit"><span className="success-check"><Check size={28} strokeWidth={2.5} /></span></div>
              <span className="step-label">VERIFICATION SENT</span>
              <h2>You’re all set.</h2>
              <p>Thanks for sending your payment details. A member of our team will review your submission and reach out if we need anything else.</p>
              <div className="reference-box"><span>REFERENCE</span><strong>{submissionReference}</strong><CheckCircle2 size={17} /></div>
              <button type="button" className="secondary-button" onClick={resetForm}><ImagePlus size={17} /> Submit another receipt</button>
            </div>
          )}
          <div className="card-footer"><span>Need help?</span><a href="mailto:payments@buildstart.co">Contact payments <ChevronRight size={14} /></a></div>
        </section>
      </main>

      <footer className="page-width site-footer"><span>© 2026 BuildStart</span><span className="footer-center"><span className="footer-dot" /> Made for clarity</span><span>Privacy is a feature</span></footer>
    </div>
  );
}
