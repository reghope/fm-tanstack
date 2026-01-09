import { useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, Image as ImageIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface PhotoUploadProps {
  onUpload: (file: File) => void;
  isDisabled?: boolean;
  className?: string;
}

export function PhotoUpload({ onUpload, isDisabled, className }: PhotoUploadProps) {
  const onDrop = useCallback(
    (acceptedFiles: File[]) => {
      if (acceptedFiles.length > 0) {
        onUpload(acceptedFiles[0]);
      }
    },
    [onUpload]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".webp"],
    },
    maxFiles: 1,
    disabled: isDisabled,
  });

  return (
    <div
      {...getRootProps()}
      className={cn(
        "relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-lg cursor-pointer transition-colors",
        isDragActive
          ? "border-primary bg-primary/5"
          : "border-muted-foreground/25 hover:border-primary/50 hover:bg-muted/50",
        isDisabled && "opacity-50 cursor-not-allowed",
        className
      )}
    >
      <input {...getInputProps()} />
      <div className="flex flex-col items-center justify-center gap-4 p-6 text-center">
        {isDragActive ? (
          <>
            <ImageIcon className="w-12 h-12 text-primary" />
            <p className="text-lg font-medium">Drop your image here</p>
          </>
        ) : (
          <>
            <Upload className="w-12 h-12 text-muted-foreground" />
            <div className="space-y-1">
              <p className="text-lg font-medium">Upload a photo</p>
              <p className="text-sm text-muted-foreground">
                Drag and drop or click to select
              </p>
              <p className="text-xs text-muted-foreground">
                PNG, JPG, JPEG or WebP
              </p>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
