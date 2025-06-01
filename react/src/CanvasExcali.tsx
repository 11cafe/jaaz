import "tldraw/tldraw.css";
import { useCallback, useEffect, useRef, useState } from "react";
import { Excalidraw, exportToBlob } from "@excalidraw/excalidraw";
import "@excalidraw/excalidraw/index.css";
import {
  AppState,
  DataURL,
  ExcalidrawImperativeAPI,
} from "@excalidraw/excalidraw/types";
import { nanoid } from "nanoid";
import {
  ExcalidrawElement,
  ExcalidrawImageElement,
  FileId,
  OrderedExcalidrawElement,
  Theme,
} from "@excalidraw/excalidraw/element/types";
import { useTheme } from "./components/theme-provider";
import debounce from "lodash.debounce"; // or use your own debounce

export default function CanvasExcali() {
  const excalidrawAPI = useRef<ExcalidrawImperativeAPI | null>(null);
  const saveScene = (elements: any[], appState: AppState, files: any[]) => {
    const data = {
      elements,
      appState: {
        ...appState,
        collaborators: undefined, // avoid circular refs
      },
      files,
    };
    localStorage.setItem("excalidraw-scene", JSON.stringify(data));
  };

  const debouncedSave = useCallback(
    debounce(saveScene, 500), // wait 500ms after changes stop
    []
  );
  const lastImagePosition = useRef<{
    x: number;
    y: number;
    width: number;
    height: number;
  }>(
    localStorage.getItem("excalidraw-last-image-position")
      ? JSON.parse(localStorage.getItem("excalidraw-last-image-position")!)
      : {
          x: 0,
          y: 0,
          width: 0,
          height: 0,
        }
  );
  const { theme } = useTheme();
  console.log("👇theme", theme);
  useEffect(() => {
    const addImageToExcalidraw = async (imageData: {
      url: string;
      mime_type: string;
      width: number;
      height: number;
    }) => {
      if (!excalidrawAPI) return;

      const imageDataUrl = imageData.url;

      if (!excalidrawAPI) return;

      // Convert base64 data URL to File
      const fileid = nanoid() as FileId;

      // Add file to Excalidraw
      excalidrawAPI.current?.addFiles([
        {
          mimeType: imageData.mime_type,
          id: fileid,
          dataURL: imageDataUrl as DataURL,
          created: Date.now(),
        },
      ]);

      // Position image next to the previous one
      const { x, y, width } = lastImagePosition.current;
      const newX = x + width + 20; // adjust spacing to 20px
      const newY = y;

      const imageElement: ExcalidrawImageElement = {
        type: "image",
        id: fileid,
        x: newX,
        y: newY,
        width: imageData.width,
        height: imageData.height,
        angle: 0,
        fileId: fileid,
        strokeColor: "#000000",
        fillStyle: "solid",
        strokeStyle: "solid",
        boundElements: null,
        roundness: null,
        frameId: null,
        backgroundColor: "transparent",
        strokeWidth: 1,
        roughness: 0,
        opacity: 100,
        groupIds: [],
        seed: Math.floor(Math.random() * 100000),
        version: 1,
        versionNonce: Math.floor(Math.random() * 100000),
        isDeleted: false,
      };
      const currentElements = excalidrawAPI.current?.getSceneElements();
      console.log("👇 adding to currentElements", currentElements);
      excalidrawAPI.current?.updateScene({
        elements: [...(currentElements || []), imageElement],
      });

      // Update position for the next image
      lastImagePosition.current = {
        x: newX,
        y: newY,
        width: imageData.width,
        height: imageData.height,
      };
      localStorage.setItem(
        "excalidraw-last-image-position",
        JSON.stringify(lastImagePosition.current)
      );
    };

    const handleImageGenerated = (e: Event) => {
      const event = e as CustomEvent;
      console.log("👇image_generated", event.detail);
      addImageToExcalidraw(event.detail.image_data);
    };

    window.addEventListener("image_generated", handleImageGenerated);
    return () =>
      window.removeEventListener("image_generated", handleImageGenerated);
  }, []);

  return (
    <Excalidraw
      theme={theme as Theme}
      excalidrawAPI={(api) => (excalidrawAPI.current = api)}
      onChange={(elements, appState, files) =>
        debouncedSave(elements, appState, files)
      }
      initialData={() => {
        const saved = localStorage.getItem("excalidraw-scene");
        return saved ? JSON.parse(saved) : undefined;
      }}
    />
  );
}
