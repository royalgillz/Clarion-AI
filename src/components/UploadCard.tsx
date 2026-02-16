/**
 * File upload card with drag-and-drop support
 * Includes accessibility features and file validation
 */

import React, { useRef, DragEvent, ChangeEvent } from 'react';
import { colors, borderRadius, spacing, shadows } from '@/lib/theme';
import { UploadCloud, FileText, Check } from 'lucide-react';

interface UploadCardProps {
  onFileSelect: (file: File) => void;
  isDragging: boolean;
  onDragStateChange: (isDragging: boolean) => void;
  maxSizeMB?: number;
}

export function UploadCard({ 
  onFileSelect, 
  isDragging, 
  onDragStateChange,
  maxSizeMB = 10 
}: UploadCardProps) {
  const fileRef = useRef<HTMLInputElement>(null);

  function handleDragEnter(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(true);
  }

  function handleDragLeave(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(false);
  }

  function handleDragOver(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
  }

  async function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    e.stopPropagation();
    onDragStateChange(false);

    const files = e.dataTransfer.files;
    if (!files || files.length === 0) return;

    const file = files[0];
    validateAndSelect(file);
  }

  function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    validateAndSelect(file);
  }

  function validateAndSelect(file: File) {
    // Validate file type
    if (!file.type.includes("pdf")) {
      alert("❌ Please upload a PDF file only.");
      return;
    }

    // Validate file size
    const maxBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxBytes) {
      alert(`❌ File too large. Maximum size is ${maxSizeMB}MB. Your file is ${(file.size / 1024 / 1024).toFixed(2)}MB.`);
      return;
    }

    onFileSelect(file);
  }

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      onClick={() => fileRef.current?.click()}
      role="button"
      tabIndex={0}
      aria-label="Upload PDF lab report. Press Enter or Space to browse files, or drag and drop a file here"
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          fileRef.current?.click();
        }
      }}
      onFocus={(e) => {
        e.currentTarget.style.outline = `3px solid ${colors.info[300]}`;
        e.currentTarget.style.outlineOffset = '2px';
      }}
      onBlur={(e) => {
        e.currentTarget.style.outline = 'none';
      }}
      style={{
        background: isDragging ? colors.accent.primary + '0d' : colors.white,
        border: isDragging ? `3px dashed ${colors.accent.primary}` : `3px dashed ${colors.gray[300]}`,
        borderRadius: borderRadius.xl,
        padding: `${spacing['3xl']} ${spacing['2xl']}`,
        textAlign: "center",
        marginBottom: spacing.xl,
        cursor: "pointer",
        transition: "all 0.3s ease",
        boxShadow: isDragging ? shadows.xl : shadows.md,
        transform: isDragging ? "scale(1.02)" : "scale(1)",
      }}
    >
      <input
        ref={fileRef}
        type="file"
        accept="application/pdf"
        style={{ display: "none" }}
        onChange={handleFile}
        aria-label="Select PDF file"
      />
      
      <div style={{
        width: 64, height: 64, margin: `0 auto ${spacing.lg}`,
        borderRadius: borderRadius.lg,
        background: isDragging ? colors.accent.primary : colors.accent.primary + '12',
        color: isDragging ? colors.white : colors.accent.primary,
        display: "flex", alignItems: "center", justifyContent: "center",
        transition: "all 0.2s"
      }} aria-hidden="true">
        {isDragging ? <UploadCloud size={30} /> : <FileText size={30} />}
      </div>

      <h3 style={{
        fontSize: 22, 
        fontWeight: 700, 
        marginBottom: spacing.sm,
        color: colors.primary[700]
      }}>
        {isDragging ? "Drop your PDF here" : "Upload your CBC Lab Report"}
      </h3>
      
      <p style={{ 
        fontSize: 15, 
        color: colors.primary[500], 
        marginBottom: spacing.lg,
        lineHeight: 1.6
      }}>
        Drag and drop your PDF file here, or click to browse
      </p>

      <div style={{
        display: "inline-block",
        background: colors.accent.primary,
        color: colors.white,
        padding: `${spacing.md} ${spacing.xl}`,
        borderRadius: borderRadius.md,
        fontWeight: 600,
        fontSize: 15,
        marginBottom: spacing.lg,
        boxShadow: '0 4px 12px rgba(14,124,123,0.25)',
        transition: "all 0.2s"
      }}
      aria-hidden="true"
      >
        Select PDF File
      </div>

      <div style={{ 
        fontSize: 12, 
        color: colors.gray[400],
        marginTop: spacing.lg
      }}>
        Accepted format: <strong>PDF only</strong> • Max size: <strong>{maxSizeMB}MB</strong>
      </div>

      {/* Microcopy */}
      <div style={{
        marginTop: spacing.xl,
        padding: spacing.lg,
        background: colors.primary[50],
        borderRadius: borderRadius.md,
        display: "flex",
        justifyContent: "center",
        gap: spacing.xl,
        flexWrap: "wrap",
        fontSize: 12,
        color: colors.primary[600]
      }}>
        {["Secure upload", "Private analysis", "In-memory processing"].map((t) => (
          <div key={t} style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
            <Check size={13} color={colors.success[600]} aria-hidden="true" /> {t}
          </div>
        ))}
      </div>
    </div>
  );
}
