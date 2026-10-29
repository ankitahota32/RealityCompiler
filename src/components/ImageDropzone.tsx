'use client';

import { useRef, useState } from 'react';
import { COPY } from './copy';
import { ACCEPTED_TYPES } from './resizeImage';
import { Button } from './ui/button';
import type { UploadedImage } from './wizardState';

/** Click or drag up to 3 images; thumbnails with remove buttons. Files are handed to `onAdd` unprocessed. */
export function ImageDropzone({
  images,
  disabled,
  onAdd,
  onRemove,
}: {
  images: UploadedImage[];
  disabled: boolean;
  onAdd: (files: File[]) => void;
  onRemove: (id: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);
  const full = images.length >= 3;

  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-ink">{COPY.images}</span>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          if (!disabled && !full) setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          if (!disabled && !full) onAdd([...e.dataTransfer.files]);
        }}
        className={`flex flex-col items-start gap-3 rounded-[16px] border border-dashed p-4 backdrop-blur-md transition-all duration-[200ms] ${
          dragOver ? 'scale-[1.01] border-glow-cyan bg-white/[0.08]' : 'border-glass-line bg-white/[0.03] hover:border-white/30 hover:bg-white/[0.05]'
        }`}
      >
        <p className="text-sm text-ink-muted">{COPY.dropzoneHint}</p>
        <Button type="button" variant="outline" disabled={disabled || full} onClick={() => inputRef.current?.click()}>
          {COPY.chooseFiles}
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPTED_TYPES.join(',')}
          multiple
          hidden
          onChange={(e) => {
            onAdd([...(e.target.files ?? [])]);
            e.target.value = '';
          }}
        />
        {images.length > 0 && (
          <ul className="flex flex-wrap gap-3">
            {images.map((img, i) => (
              <li key={img.id} className="flex flex-col items-start gap-1">
                {/* Local object URL of the resized image; never stored. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt={COPY.imageAlt(i + 1)} className="h-20 w-20 rounded-sm border border-line object-cover" />
                <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => onRemove(img.id)}>
                  {COPY.removeImage(i + 1)}
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
