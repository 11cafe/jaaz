import "tldraw/tldraw.css";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  TLEditorSnapshot,
  TLImageShape,
  Tldraw,
  createShapeId,
  getSnapshot,
  loadSnapshot,
  useEditor,
  Editor,
  TLImageAsset,
  AssetRecordType,
} from "tldraw";

import "tldraw/tldraw.css";
import { Button } from "./components/ui/button";
import { ChevronDownIcon, FolderIcon, PlusIcon } from "lucide-react";
import LeftSidebar from "./LeftSidebar";
import { toast } from "sonner";

// import _jsonSnapshot from "./snapshot.json";

// There's a guide at the bottom of this file!

// const jsonSnapshot = _jsonSnapshot as any as TLEditorSnapshot;

function debounce(func: Function, wait: number) {
  let timeout: NodeJS.Timeout;
  return function executedFunction(...args: any[]) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Assume 'editor' is your tldraw Editor instance
// Assume 'id' is the desired ID for your shape, or generate one:

async function addImageToTldraw(
  editor: Editor,
  imageData: {
    url: string;
    mime_type: string;
    width: number;
    height: number;
  }
) {
  // Optional: Fetch image to get its natural dimensions for the asset metadata
  // This is good practice but not strictly necessary if you know them.
  const shapeId = createShapeId();

  // 1. Create the asset
  const assetId = AssetRecordType.createId();

  const imageAsset: TLImageAsset = {
    id: assetId,
    meta: {},
    type: "image",
    typeName: "asset",
    props: {
      src: imageData.url,
      h: imageData.height,
      w: imageData.width,
      isAnimated: false,
      mimeType: imageData.mime_type,
      name: "image.png",
    },
  };
  editor.createAssets([imageAsset]);

  // 2. Create the shape and link it to the asset
  editor.createShape<TLImageShape>({
    id: shapeId,
    type: "image",
    x: 100,
    y: 100,
    props: {
      assetId: assetId, // Link to the created asset
      w: imageData.width, // Desired display width on the canvas
      h: imageData.height, // Desired display height on the canvas
      // playing: false, // if it were an animated image/gif
      // crop: null,
    },
  });
}

function AutoSaveWrapper() {
  const editor = useEditor();
  const [imageId, setImageId] = useState("");
  useEffect(() => {
    window.addEventListener("image_generated", (e) => {
      const event = e as CustomEvent;
      console.log("👇image_generated", event.detail);
      addImageToTldraw(editor, event.detail.image_data);
    });
  }, []);

  const saveSnapshot = useCallback(() => {
    if (editor) {
      const { document, session } = getSnapshot(editor.store);

      localStorage.setItem("snapshot", JSON.stringify({ document, session }));
      console.log("Auto-saved snapshot");
    }
  }, [editor]);

  const debouncedSave = useMemo(
    () => debounce(saveSnapshot, 1000),
    [saveSnapshot]
  );

  useEffect(() => {
    if (!editor) return;

    const unsubscribe = editor.store.listen(() => {
      debouncedSave();
    });

    return unsubscribe;
  }, [editor, debouncedSave]);

  return (
    <div>
      <SnapshotToolbar />
    </div>
  );
}
function SnapshotToolbar() {
  const editor = useEditor();

  useEffect(() => {
    if (!editor) return;

    // Listen for any changes to the store
    const unsubscribe = editor.store.listen(() => {
      // Debounce the save operation to avoid too frequent saves

      save();
    });

    return unsubscribe;
  }, [editor]);

  const save = useCallback(() => {
    // [2]
    const { document, session } = getSnapshot(editor.store);
    // [3]
    console.log("🦄snapshot", {
      document,
      session,
    });
    localStorage.setItem("snapshot", JSON.stringify({ document, session }));
  }, [editor]);

  const load = useCallback(() => {
    const snapshot = localStorage.getItem("snapshot");
    if (!snapshot) return;

    // [4]
    loadSnapshot(editor.store, JSON.parse(snapshot));
  }, [editor]);

  const [showCheckMark, setShowCheckMark] = useState(false);
  useEffect(() => {
    if (showCheckMark) {
      const timeout = setTimeout(() => {
        setShowCheckMark(false);
      }, 1000);
      return () => clearTimeout(timeout);
    }
    return;
  });

  return (
    <div
      style={{
        padding: 20,
        pointerEvents: "all",
        display: "flex",
        gap: "10px",
      }}
    >
      <span
        style={{
          display: "inline-block",
          transition: "transform 0.2s ease, opacity 0.2s ease",
          transform: showCheckMark ? `scale(1)` : `scale(0.5)`,
          opacity: showCheckMark ? 1 : 0,
        }}
      >
        Saved ✅
      </span>
      <button
        onClick={() => {
          save();
          setShowCheckMark(true);
        }}
      >
        Save Snapshot
      </button>
      <button onClick={load}>Load Snapshot</button>
    </div>
  );
}
function CustomPageMenu() {
  const [pageName, setPageName] = useState("Untitled");
  const [openWorkspace, setOpenWorkspace] = useState(false);
  const [curFile, setCurFile] = useState("");
  const editor = useEditor();

  return (
    <div
      className="flex gap-2 items-center"
      style={{
        // zIndex: 1000,
        pointerEvents: "auto", // ✅ This is key
      }}
    >
      <Button
        size="sm"
        // variant="secondary"
        onClick={() => {
          // clear the canvas
          editor?.store.clear();
          fetch("/api/create_file", {
            method: "POST",
            body: JSON.stringify({ rel_dir: "" }),
          })
            .then((res) => res.json())
            .then((data) => {
              if (data.path) {
                setCurFile(data.path);
                dispatchEvent(new Event("refresh_workspace"));
              } else {
                throw new Error("Failed to create file");
              }
            })
            .catch((err) => {
              toast.error("Failed to create file");
            });
        }}
      >
        <PlusIcon />
      </Button>
      <Button
        size="sm"
        variant="secondary"
        onClick={() => {
          setOpenWorkspace(true);
        }}
      >
        <FolderIcon />
        <ChevronDownIcon className="w-4 h-4" />
      </Button>
      <input
        type="text"
        placeholder="Untitled"
        className="border-none outline-none"
        value={pageName}
        onChange={(e) => setPageName(e.target.value)}
      />
      {openWorkspace && (
        <div className="absolute z-40000 left-0 top-0 w-[300px] h-full">
          <LeftSidebar
            sessionId={""}
            setSessionId={() => {}}
            curFile={curFile}
            setCurFile={setCurFile}
            onClose={() => {
              setOpenWorkspace(false);
            }}
          />
        </div>
      )}
    </div>
  );
}
export default function Canvas() {
  return (
    <Tldraw
      //   persistenceKey="disable-pages"
      //   options={{ maxPages: 1 }}
      components={{
        SharePanel: AutoSaveWrapper,
        PageMenu: CustomPageMenu,
      }}
    ></Tldraw>
  );
}
