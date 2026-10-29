'use client';

import type { ProjectInput } from '@/core/types';
import { COPY, FLOW_TYPE_OPTIONS } from './copy';
import { ImageDropzone } from './ImageDropzone';
import { PrivacyNotice } from './PrivacyNotice';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { NativeSelect } from './ui/native-select';
import { Textarea } from './ui/textarea';
import type { UploadedImage } from './wizardState';

const MAX_TEXT = 4000;

/** Step 1: flow name, flow type, text, images, privacy note, and the two actions. */
export function InputPanel({
  input,
  images,
  busy,
  onChange,
  onAddImages,
  onRemoveImage,
  onReadPlan,
  onDemo,
}: {
  input: ProjectInput;
  images: UploadedImage[];
  busy: boolean;
  onChange: (input: Partial<ProjectInput>) => void;
  onAddImages: (files: File[]) => void;
  onRemoveImage: (id: string) => void;
  onReadPlan: () => void;
  onDemo: () => void;
}) {
  return (
    <form
      className="flex flex-col gap-6"
      onSubmit={(e) => {
        e.preventDefault();
        onReadPlan();
      }}
    >
      <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
        <div className="flex flex-col gap-2">
          <Label htmlFor="flow-name">{COPY.flowName}</Label>
          <Input
            id="flow-name"
            required
            maxLength={80}
            value={input.flowName}
            disabled={busy}
            onChange={(e) => onChange({ flowName: e.target.value })}
          />
        </div>
        <div className="flex flex-col gap-2">
          <Label htmlFor="flow-type">{COPY.flowType}</Label>
          <NativeSelect
            id="flow-type"
            value={input.flowType}
            disabled={busy}
            onChange={(e) => onChange({ flowType: e.target.value as ProjectInput['flowType'] })}
          >
            {FLOW_TYPE_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </NativeSelect>
        </div>
      </div>

      <div className="flex flex-col gap-2">
        <Label htmlFor="plan-text">{COPY.planText}</Label>
        <Textarea
          id="plan-text"
          rows={8}
          maxLength={MAX_TEXT}
          value={input.text}
          disabled={busy}
          aria-describedby="plan-text-count"
          onChange={(e) => onChange({ text: e.target.value })}
          className="min-h-40"
        />
        <p id="plan-text-count" className="self-end text-sm text-ink-muted">
          {input.text.length} / {MAX_TEXT}
        </p>
      </div>

      <ImageDropzone images={images} disabled={busy} onAdd={onAddImages} onRemove={onRemoveImage} />

      <PrivacyNotice />

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="button" variant="outline" disabled={busy} onClick={onDemo} className="w-full sm:w-auto">
          {COPY.tryDemo}
        </Button>
        <Button type="submit" disabled={busy} className="w-full sm:w-auto">
          {COPY.readPlan}
        </Button>
      </div>
    </form>
  );
}
