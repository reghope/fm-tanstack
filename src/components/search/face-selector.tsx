import { cn } from "@/lib/utils";
import type { CroppedFace } from "@/hooks/use-face-detection";

interface FaceSelectorProps {
  faces: CroppedFace[];
  onSelect: (face: CroppedFace) => void;
  selectedId?: string;
}

export function FaceSelector({ faces, onSelect, selectedId }: FaceSelectorProps) {
  if (faces.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        No faces detected in the image
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground text-center">
        {faces.length} face{faces.length > 1 ? "s" : ""} detected. Select one to search:
      </p>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
        {faces.map((face) => (
          <button
            key={face.id}
            onClick={() => onSelect(face)}
            className={cn(
              "relative aspect-square rounded-lg overflow-hidden border-2 transition-all hover:scale-105",
              selectedId === face.id
                ? "border-primary ring-2 ring-primary ring-offset-2"
                : "border-transparent hover:border-primary/50"
            )}
          >
            <img
              src={face.imageData}
              alt={`Detected face ${face.id}`}
              className="absolute inset-0 h-full w-full object-cover"
            />
            {selectedId === face.id && (
              <div className="absolute inset-0 bg-primary/20 flex items-center justify-center">
                <div className="bg-primary text-primary-foreground rounded-full p-1">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M5 13l4 4L19 7"
                    />
                  </svg>
                </div>
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}
