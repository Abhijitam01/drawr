"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useAuth } from "../../context/AuthContext";
import { HTTP_BACKEND, WS_BACKEND } from "@/config";
import axios from "axios";
import { Toolbar, Tool } from "../../components/canvas/Toolbar";
import { ZoomControls } from "../../components/canvas/ZoomControls";
import { MainMenu } from "../../components/canvas/MainMenu";
import { PropertyBar, FillStyle } from "../../components/canvas/PropertyBar";
import rough from "roughjs";
import { RoughCanvas } from "roughjs/bin/canvas";

type Point = { x: number; y: number };

type ShapeStyle = {
  stroke: string;
  backgroundColor: string;
  strokeWidth: number;
  strokeStyle: "solid" | "dashed" | "dotted";
  roughness: number;
  roundness: "sharp" | "round";
  opacity: number;
  fillStyle: FillStyle;
};

type Shape = { id: string } & (
  | {
      type: "rect";
      x: number;
      y: number;
      width: number;
      height: number;
      style: ShapeStyle;
    }
  | {
      type: "circle";
      centerX: number;
      centerY: number;
      radius: number;
      style: ShapeStyle;
    }
  | {
      type: "diamond";
      x: number;
      y: number;
      width: number;
      height: number;
      style: ShapeStyle;
    }
  | {
      type: "arrow";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      style: ShapeStyle;
    }
  | {
      type: "line";
      startX: number;
      startY: number;
      endX: number;
      endY: number;
      style: ShapeStyle;
    }
  | { type: "pencil"; points: Point[]; style: ShapeStyle }
  | { type: "text"; x: number; y: number; text: string; style: ShapeStyle }
);

export default function DrawPage() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <DrawContent />
    </Suspense>
  );
}

function DrawContent() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const interactiveCanvasRef = useRef<HTMLCanvasElement>(null);
  const [selectedTool, setSelectedTool] = useState<Tool>("rect");
  const [zoom, setZoom] = useState(1);
  const [camera, setCamera] = useState({ x: 0, y: 0 });
  const [history, setHistory] = useState<Shape[][]>([]);
  const [redoStack, setRedoStack] = useState<Shape[][]>([]);
  const [selectedShapeId, setSelectedShapeId] = useState<string | null>(null);
  const [shapes, setShapes] = useState<Shape[]>([]);
  const [collaborators, setCollaborators] = useState<
    Record<string, { name: string; x: number; y: number }>
  >({});
  const [onlineUsers, setOnlineUsers] = useState<
    { userId: string; name: string }[]
  >([]);
  const [editingTextId, setEditingTextId] = useState<string | null>(null);
  const [editingTextPosition, setEditingTextPosition] = useState<{ x: number; y: number } | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement>(null);

  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") || "1";
  const { token } = useAuth();

  // Styling state
  // Styling state
  const [strokeColor, setStrokeColor] = useState("#ECECEC");
  const [backgroundColor, setBackgroundColor] = useState("transparent");
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeStyle, setStrokeStyle] = useState<"solid" | "dashed" | "dotted">(
    "solid"
  );
  const [roughness, setRoughness] = useState(1);
  const [roundness, setRoundness] = useState<"sharp" | "round">("round");
  const [opacity, setOpacity] = useState(100);
  const [fillStyle, setFillStyle] = useState<FillStyle>("hachure");

  const router = useRouter();

  // Refs for canvas logic to avoid re-initialization
  const selectedToolRef = useRef(selectedTool);
  const zoomRef = useRef(zoom);
  const cameraRef = useRef(camera);
  const selectedShapeIdRef = useRef(selectedShapeId);

  const currentStyleRef = useRef<ShapeStyle>({
    stroke: strokeColor,
    backgroundColor,
    strokeWidth,
    strokeStyle,
    roughness,
    roundness,
    opacity,
    fillStyle,
  });

  useEffect(() => {
    selectedToolRef.current = selectedTool;
    zoomRef.current = zoom;
    cameraRef.current = camera;
    selectedShapeIdRef.current = selectedShapeId;
    currentStyleRef.current = {
      stroke: strokeColor,
      backgroundColor,
      strokeWidth,
      strokeStyle,
      roughness,
      roundness,
      opacity,
      fillStyle,
    };
  }, [
    selectedTool,
    zoom,
    camera,
    selectedShapeId,
    strokeColor,
    backgroundColor,
    strokeWidth,
    strokeStyle,
    roughness,
    roundness,
    opacity,
    fillStyle,
  ]);

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_BACKEND}?token=${token}`);
    socketRef.current = ws;

    const handleResize = () => {
      const dpr = window.devicePixelRatio || 1;
      const width = window.innerWidth;
      const height = window.innerHeight;

      if (canvasRef.current) {
        canvasRef.current.width = width * dpr;
        canvasRef.current.height = height * dpr;
        canvasRef.current.style.width = `${width}px`;
        canvasRef.current.style.height = `${height}px`;
        const ctx = canvasRef.current.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }

      if (interactiveCanvasRef.current) {
        interactiveCanvasRef.current.width = width * dpr;
        interactiveCanvasRef.current.height = height * dpr;
        interactiveCanvasRef.current.style.width = `${width}px`;
        interactiveCanvasRef.current.style.height = `${height}px`;
        const ctx = interactiveCanvasRef.current.getContext("2d");
        if (ctx) {
          ctx.scale(dpr, dpr);
        }
      }
    };

    window.addEventListener("resize", handleResize);
    handleResize();

    return () => {
      ws.close();
      window.removeEventListener("resize", handleResize);
    };
  }, [token]);

  const shapesRef = useRef<Shape[]>(shapes);
  const collaboratorsRef =
    useRef<Record<string, { name: string; x: number; y: number }>>(
      collaborators
    );
  const socketRefForText = useRef<WebSocket | null>(null);
  const onShapesUpdateRef = useRef<((shapes: Shape[]) => void) | null>(null);
  const roomIdRef = useRef<string>(roomId);

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    collaboratorsRef.current = collaborators;
  }, [collaborators]);

  useEffect(() => {
    roomIdRef.current = roomId;
  }, [roomId]);

  useEffect(() => {
    socketRefForText.current = socketRef.current;
  }, [socketRef.current]);

  useEffect(() => {
    if (editingTextId && textInputRef.current) {
      textInputRef.current.focus();
      textInputRef.current.select();
    }
  }, [editingTextId]);

  const handleTextEditComplete = (text: string, shapeId: string) => {
    if (text.trim()) {
      const newShapes = shapes.map((s) =>
        s.id === shapeId && s.type === "text" ? { ...s, text } : s
      );
      setShapes(newShapes);
      if (onShapesUpdateRef.current) {
        onShapesUpdateRef.current(newShapes);
      }
      if (socketRefForText.current) {
        const shape = newShapes.find((s) => s.id === shapeId);
        if (shape) {
          socketRefForText.current.send(
            JSON.stringify({
              type: "chat",
              message: JSON.stringify({ type: "update", shape }),
              roomId: roomIdRef.current,
            })
          );
        }
      }
    } else {
      const newShapes = shapes.filter((s) => s.id !== shapeId);
      setShapes(newShapes);
      if (onShapesUpdateRef.current) {
        onShapesUpdateRef.current(newShapes);
      }
      if (socketRefForText.current) {
        socketRefForText.current.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ type: "delete", id: shapeId }),
            roomId: roomIdRef.current,
          })
        );
      }
    }
    setEditingTextId(null);
    setEditingTextPosition(null);
  };

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (canvasRef.current && interactiveCanvasRef.current && socketRef.current) {
      const onShapesUpdateCallback = (newShapes: Shape[]) => {
        setHistory((prev) => [...prev, newShapes]);
        setRedoStack([]);
        setShapes(newShapes);
      };
      onShapesUpdateRef.current = onShapesUpdateCallback;
      cleanup = initDraw(
        canvasRef.current,
        interactiveCanvasRef.current,
        roomId,
        socketRef.current,
        selectedToolRef,
        zoomRef,
        cameraRef,
        currentStyleRef,
        onShapesUpdateCallback,
        (newZoom, newCamera) => {
          setZoom(newZoom);
          setCamera(newCamera);
        },
        (tool) => setSelectedTool(tool),
        selectedShapeIdRef,
        setSelectedShapeId,
        setCollaborators,
        setOnlineUsers,
        shapesRef,
        setShapes,
        collaboratorsRef,
        setEditingTextId,
        setEditingTextPosition,
        zoom,
        camera
      );
    }
    return () => {
      cleanup?.();
    };
  }, [roomId, token, zoom, camera]);

  const undo = () => {
    if (history.length === 0) return;
    const last = history[history.length - 1];
    setRedoStack((prev) => [...prev, last]);
    setHistory((prev) => prev.slice(0, -1));
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const last = redoStack[redoStack.length - 1];
    setHistory((prev) => [...prev, last]);
    setRedoStack((prev) => prev.slice(0, -1));
  };

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#121212]">
      <MainMenu />
      <Toolbar selectedTool={selectedTool} setSelectedTool={setSelectedTool} />
      <PropertyBar
        strokeColor={strokeColor}
        setStrokeColor={setStrokeColor}
        backgroundColor={backgroundColor}
        setBackgroundColor={setBackgroundColor}
        strokeWidth={strokeWidth}
        setStrokeWidth={setStrokeWidth}
        strokeStyle={strokeStyle}
        setStrokeStyle={setStrokeStyle}
        roughness={roughness}
        setRoughness={setRoughness}
        roundness={roundness}
        setRoundness={setRoundness}
        opacity={opacity}
        setOpacity={setOpacity}
        onBack={() => router.push("/dashboard")}
        onExportPNG={() => exportToPNG(canvasRef.current)}
        onExportSVG={() => exportToSVG(shapes, canvasRef.current)}
      />

      <ZoomControls
        zoom={zoom}
        setZoom={setZoom}
        undo={undo}
        redo={redo}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
      />

      <div className="relative h-full w-full">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <canvas
          ref={interactiveCanvasRef}
          className="absolute inset-0 h-full w-full cursor-crosshair"
        />
        {editingTextId && editingTextPosition && (() => {
          const textShape = shapes.find((s) => s.id === editingTextId && s.type === "text");
          return (
            <textarea
              ref={textInputRef}
              className="absolute border-none bg-transparent text-white outline-none resize-none overflow-hidden"
              style={{
                left: `${editingTextPosition.x * zoom + camera.x}px`,
                top: `${(editingTextPosition.y - 20) * zoom + camera.y}px`,
                fontSize: `${20 * zoom}px`,
                fontFamily: "sans-serif",
                color: textShape?.style.stroke || strokeColor,
                transform: "translate(0, 0)",
              }}
              defaultValue={textShape?.text || ""}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                if (editingTextId) {
                  handleTextEditComplete(e.currentTarget.value, editingTextId);
                }
              } else if (e.key === "Escape") {
                setEditingTextId(null);
                setEditingTextPosition(null);
              }
            }}
            onBlur={() => {
              if (textInputRef.current && editingTextId) {
                handleTextEditComplete(textInputRef.current.value, editingTextId);
              }
            }}
            autoFocus
            />
          );
        })()}
      </div>

      <div className="pointer-events-none fixed bottom-6 left-6 text-[10px] font-medium tracking-widest text-zinc-500 uppercase">
        Space + Drag to Pan • Scroll to Zoom
      </div>
    </div>
  );
}

function initDraw(
  canvas: HTMLCanvasElement,
  interactiveCanvas: HTMLCanvasElement,
  roomId: string,
  socket: WebSocket,
  selectedToolRef: React.MutableRefObject<Tool>,
  zoomRef: React.MutableRefObject<number>,
  cameraRef: React.MutableRefObject<{ x: number; y: number }>,
  currentStyleRef: React.MutableRefObject<ShapeStyle>,
  onShapesUpdate: (shapes: Shape[]) => void,
  onCameraUpdate: (zoom: number, camera: { x: number; y: number }) => void,
  onToolSelect: (tool: Tool) => void,
  selectedShapeIdRef: React.MutableRefObject<string | null>,
  setSelectedShapeId: (id: string | null) => void,
  setCollaborators: React.Dispatch<
    React.SetStateAction<Record<string, { name: string; x: number; y: number }>>
  >,
  setOnlineUsers: React.Dispatch<
    React.SetStateAction<{ userId: string; name: string }[]>
  >,
  shapesRef: React.RefObject<Shape[]>,
  setShapes: React.Dispatch<React.SetStateAction<Shape[]>>,
  collaboratorsRef: React.RefObject<
    Record<string, { name: string; x: number; y: number }>
  >,
  setEditingTextId: (id: string | null) => void,
  setEditingTextPosition: (pos: { x: number; y: number } | null) => void,
  currentZoom: number,
  currentCamera: { x: number; y: number }
) {
  const ctx = canvas.getContext("2d");
  const interactiveCtx = interactiveCanvas.getContext("2d");
  if (!ctx || !interactiveCtx) return;
  const dpr = window.devicePixelRatio || 1;
  ctx.scale(dpr, dpr);
  interactiveCtx.scale(dpr, dpr);
  const rc = rough.canvas(canvas);
  const interactiveRc = rough.canvas(interactiveCanvas);

  let clicked = false;
  let isPanning = false;
  let startX = 0;
  let startY = 0;
  let lastPanX = 0;
  let lastPanY = 0;
  let spacePressed = false;
  let currentPencilPoints: Point[] = [];
  let dragStart: Point | null = null;
  let initialShapePos: Shape | null = null;
  let resizeHandle: string | null = null;
  let lastClickTime = 0;
  let lastClickPos: Point | null = null;
  let rafId: number | null = null;

  getExistingShapes(roomId).then((s) => {
    setShapes(s);
  });

  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify({ type: "join_room", roomId }));
  } else {
    socket.addEventListener("open", () => {
      socket.send(JSON.stringify({ type: "join_room", roomId }));
    });
  }

  const onMessage = (event: MessageEvent) => {
    const message = JSON.parse(event.data);
    if (message.type === "chat") {
      const parsedShape = JSON.parse(message.message);
      if (parsedShape.type === "clear") {
        setShapes([]);
      } else if (parsedShape.type === "delete") {
        setShapes((prev) => prev.filter((s) => s.id !== parsedShape.id));
      } else if (parsedShape.type === "update") {
        setShapes((prev) =>
          prev.map((s) =>
            s.id === parsedShape.shape.id ? parsedShape.shape : s
          )
        );
      } else {
        setShapes((prev) => [...prev, parsedShape.shape]);
      }
    } else if (message.type === "cursor_move") {
      setCollaborators((prev) => ({
        ...prev,
        [message.userId]: { name: message.name, x: message.x, y: message.y },
      }));
      renderInteractive();
    } else if (message.type === "user_list") {
      setOnlineUsers(message.users);
    }
  };

  socket.addEventListener("message", onMessage);

  const getMousePos = (e: MouseEvent) => {
    return {
      x: (e.clientX - cameraRef.current.x) / zoomRef.current,
      y: (e.clientY - cameraRef.current.y) / zoomRef.current,
    };
  };

  let lastShapesHash = "";

  const renderStatic = () => {
    const shapes = shapesRef.current || [];
    const shapesHash = JSON.stringify(shapes);
    if (shapesHash !== lastShapesHash) {
      renderStaticCanvas(
        shapes,
        canvas,
        ctx,
        rc,
        zoomRef.current,
        cameraRef.current
      );
      lastShapesHash = shapesHash;
    }
  };

  const renderInteractive = () => {
    renderInteractiveCanvas(
      shapesRef.current || [],
      interactiveCanvas,
      interactiveCtx,
      zoomRef.current,
      cameraRef.current,
      selectedShapeIdRef.current,
      collaboratorsRef.current || {}
    );
  };

  const renderWithRAF = () => {
    if (rafId !== null) return;
    rafId = requestAnimationFrame(() => {
      renderStatic();
      renderInteractive();
      rafId = null;
    });
  };

  const render = () => {
    renderStatic();
    renderInteractive();
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (spacePressed || e.button === 1) {
      isPanning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }

    const selectedTool = selectedToolRef.current;

    if (selectedTool === "clear") {
      if (confirm("Clear entire canvas?")) {
        setShapes([]);
        onShapesUpdate([]);
        socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ type: "clear" }),
            roomId,
          })
        );
        renderStatic();
        renderInteractive();
      }
      return;
    }

    const pos = getMousePos(e);

    if (selectedTool === "select") {
      // Check handles first
      const selectedShapeId = selectedShapeIdRef.current;
      if (selectedShapeId) {
        const shape = shapesRef.current?.find((s) => s.id === selectedShapeId);
        if (shape) {
          const handles = getHandles(shape);
          const handle = handles.find(
            (h) =>
              Math.sqrt((h.x - pos.x) ** 2 + (h.y - pos.y) ** 2) <
              10 / zoomRef.current
          );
          if (handle) {
            resizeHandle = handle.id;
            clicked = true;
            dragStart = pos;
            initialShapePos = JSON.parse(JSON.stringify(shape));
            return;
          }
        }
      }

      const shape = [...(shapesRef.current || [])]
        .reverse()
        .find((s) => isPointInShape(pos, s, zoomRef.current));
      if (shape) {
        setSelectedShapeId(shape.id);
        clicked = true;
        dragStart = pos;
        initialShapePos = JSON.parse(JSON.stringify(shape));
      } else {
        setSelectedShapeId(null);
      }
      renderInteractive();
      return;
    }

    if (selectedTool === "eraser") {
      const shapeToDelete = shapesRef.current?.find((s) =>
        isPointInShape(pos, s, zoomRef.current)
      );
      if (shapeToDelete) {
        const newShapes = (shapesRef.current || []).filter(
          (s) => s.id !== shapeToDelete.id
        );
        setShapes(newShapes);
        onShapesUpdate(newShapes);
        socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ type: "delete", id: shapeToDelete.id }),
            roomId,
          })
        );
        renderStatic();
        renderInteractive();
      }
      return;
    }

    const now = Date.now();
    const isDoubleClick =
      now - lastClickTime < 300 &&
      lastClickPos &&
      Math.abs(lastClickPos.x - pos.x) < 5 &&
      Math.abs(lastClickPos.y - pos.y) < 5;

    if (isDoubleClick && lastClickPos) {
      const textShape = [...(shapesRef.current || [])]
        .reverse()
        .find((s) => s.type === "text" && isPointInShape(lastClickPos!, s, zoomRef.current));
      if (textShape) {
        setEditingTextId(textShape.id);
        setEditingTextPosition({ x: textShape.x, y: textShape.y });
        lastClickTime = 0;
        lastClickPos = null;
        return;
      }
    }

    if (selectedTool === "text") {
      const shape: Shape = {
        id: Math.random().toString(36).substr(2, 9),
        type: "text",
        x: pos.x,
        y: pos.y,
        text: "",
        style: currentStyleRef.current,
      };
      const newShapes = [...(shapesRef.current || []), shape];
      setShapes(newShapes);
      setEditingTextId(shape.id);
      setEditingTextPosition({ x: pos.x, y: pos.y });
      lastClickTime = now;
      lastClickPos = pos;
      return;
    }

    lastClickTime = now;
    lastClickPos = pos;

    clicked = true;
    startX = pos.x;
    startY = pos.y;

    if (selectedTool === "pencil") {
      currentPencilPoints = [{ x: pos.x, y: pos.y }];
    }
  };

  const handleMouseUp = (e: MouseEvent) => {
    if (isPanning) {
      isPanning = false;
      return;
    }

    if (!clicked) return;
    clicked = false;
    const pos = getMousePos(e);
    const selectedTool = selectedToolRef.current;
    const selectedShapeId = selectedShapeIdRef.current;

    if (selectedTool === "select" && selectedShapeId && dragStart) {
      const movedShape = shapesRef.current?.find(
        (s) => s.id === selectedShapeId
      );
      if (movedShape) {
        setShapes(shapesRef.current || []);
        onShapesUpdate(shapesRef.current || []);
        socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ type: "update", shape: movedShape }),
            roomId,
          })
        );
        renderStatic();
        renderInteractive();
      }
      dragStart = null;
      initialShapePos = null;
      resizeHandle = null;
      return;
    }

    const width = pos.x - startX;
    const height = pos.y - startY;

    let shape: Shape | null = null;
    const id = Math.random().toString(36).substr(2, 9);
    const currentStyle = currentStyleRef.current;

    switch (selectedTool) {
      case "rect":
        shape = {
          id,
          type: "rect",
          x: startX,
          y: startY,
          width,
          height,
          style: currentStyle,
        };
        break;
      case "circle":
        const radius = Math.sqrt(width * width + height * height);
        shape = {
          id,
          type: "circle",
          centerX: startX,
          centerY: startY,
          radius,
          style: currentStyle,
        };
        break;
      case "diamond":
        shape = {
          id,
          type: "diamond",
          x: startX,
          y: startY,
          width,
          height,
          style: currentStyle,
        };
        break;
      case "arrow":
        shape = {
          id,
          type: "arrow",
          startX,
          startY,
          endX: pos.x,
          endY: pos.y,
          style: currentStyle,
        };
        break;
      case "line":
        shape = {
          id,
          type: "line",
          startX,
          startY,
          endX: pos.x,
          endY: pos.y,
          style: currentStyle,
        };
        break;
      case "pencil":
        if (currentPencilPoints.length > 1) {
          shape = {
            id,
            type: "pencil",
            points: currentPencilPoints,
            style: currentStyle,
          };
        }
        currentPencilPoints = [];
        break;
    }

    if (!shape) return;

    const newShapes = [...(shapesRef.current || []), shape];
    setShapes(newShapes);
    shapesRef.current = newShapes; // Update ref immediately
    onShapesUpdate(newShapes);

    socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify({ shape }),
        roomId,
      })
    );
    renderStatic();
    renderInteractive();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanX;
      const dy = e.clientY - lastPanY;
      onCameraUpdate(zoomRef.current, {
        x: cameraRef.current.x + dx,
        y: cameraRef.current.y + dy,
      });
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }

    if (clicked) {
      const pos = getMousePos(e);
      const selectedTool = selectedToolRef.current;
      const selectedShapeId = selectedShapeIdRef.current;

      if (
        selectedTool === "select" &&
        selectedShapeId &&
        dragStart &&
        initialShapePos
      ) {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        const initialPos = initialShapePos;

        const newShapes = (shapesRef.current || []).map((s) => {
          if (s.id === selectedShapeId) {
            if (resizeHandle) {
              return resizeShape(s, initialPos, resizeHandle, pos);
            }
            if (
              (s.type === "rect" ||
                s.type === "diamond" ||
                s.type === "text") &&
              (initialPos.type === "rect" ||
                initialPos.type === "diamond" ||
                initialPos.type === "text")
            ) {
              return {
                ...s,
                x: initialPos.x + dx,
                y: initialPos.y + dy,
              };
            } else if (s.type === "circle" && initialPos.type === "circle") {
              return {
                ...s,
                centerX: initialPos.centerX + dx,
                centerY: initialPos.centerY + dy,
              };
            } else if (
              (s.type === "arrow" || s.type === "line") &&
              (initialPos.type === "arrow" || initialPos.type === "line")
            ) {
              return {
                ...s,
                startX: initialPos.startX + dx,
                startY: initialPos.startY + dy,
                endX: initialPos.endX + dx,
                endY: initialPos.endY + dy,
              };
            } else if (s.type === "pencil" && initialPos.type === "pencil") {
              return {
                ...s,
                points: initialPos.points.map((p: Point) => ({
                  x: p.x + dx,
                  y: p.y + dy,
                })),
              };
            }
          }
          return s;
        });
        shapesRef.current = newShapes;
        renderWithRAF();
      return;
    }

      renderInteractive();

      interactiveCtx.save();
      const zoom = zoomRef.current;
      const camera = cameraRef.current;
      interactiveCtx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);

      const width = pos.x - startX;
      const height = pos.y - startY;

      const roughOpts = {
        stroke: "#A5A5A5",
        strokeWidth: 2 / zoom,
        roughness: 1,
      };

      if (selectedTool === "rect") {
        interactiveRc.rectangle(startX, startY, width, height, roughOpts);
      } else if (selectedTool === "circle") {
        const radius = Math.sqrt(width * width + height * height);
        interactiveRc.circle(startX, startY, radius * 2, roughOpts);
      } else if (selectedTool === "diamond") {
        interactiveRc.polygon(
          [
            [startX + width / 2, startY],
            [startX + width, startY + height / 2],
            [startX + width / 2, startY + height],
            [startX, startY + height / 2],
          ],
          roughOpts
        );
      } else if (selectedTool === "arrow") {
        interactiveRc.line(startX, startY, pos.x, pos.y, roughOpts);
        const angle = Math.atan2(pos.y - startY, pos.x - startX);
        const headlen = 10 / zoom;
        interactiveRc.line(
          pos.x,
          pos.y,
          pos.x - headlen * Math.cos(angle - Math.PI / 6),
          pos.y - headlen * Math.sin(angle - Math.PI / 6),
          roughOpts
        );
        interactiveRc.line(
          pos.x,
          pos.y,
          pos.x - headlen * Math.cos(angle + Math.PI / 6),
          pos.y - headlen * Math.sin(angle + Math.PI / 6),
          roughOpts
        );
      } else if (selectedTool === "line") {
        interactiveRc.line(startX, startY, pos.x, pos.y, roughOpts);
      } else if (selectedTool === "pencil") {
        currentPencilPoints.push({ x: pos.x, y: pos.y });
        if (currentPencilPoints.length > 1) {
          interactiveRc.linearPath(
            currentPencilPoints.map((p) => [p.x, p.y]),
            roughOpts
          );
        }
      }
      interactiveCtx.restore();
    }

    // Broadcast cursor position
    const pos = getMousePos(e);
    socket.send(
      JSON.stringify({
        type: "cursor_move",
        roomId,
        x: pos.x,
        y: pos.y,
      })
    );
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    const zoom = zoomRef.current;
    const camera = cameraRef.current;

    const zoomFactor = 1.1;
    const newZoom = e.deltaY > 0 ? zoom / zoomFactor : zoom * zoomFactor;
    const clampedZoom = Math.min(Math.max(newZoom, 0.1), 10);

    const mouseX = e.clientX;
    const mouseY = e.clientY;

    const worldX = (mouseX - camera.x) / zoom;
    const worldY = (mouseY - camera.y) / zoom;

    const newCameraX = mouseX - worldX * clampedZoom;
    const newCameraY = mouseY - worldY * clampedZoom;

    onCameraUpdate(clampedZoom, { x: newCameraX, y: newCameraY });
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.code === "Space") spacePressed = true;

    switch (e.key.toLowerCase()) {
      case "v":
        onToolSelect("select");
        break;
      case "r":
        onToolSelect("rect");
        break;
      case "d":
        onToolSelect("diamond");
        break;
      case "o":
        onToolSelect("circle");
        break;
      case "a":
        onToolSelect("arrow");
        break;
      case "l":
        onToolSelect("line");
        break;
      case "p":
        onToolSelect("pencil");
        break;
      case "t":
        onToolSelect("text");
        break;
      case "e":
        onToolSelect("eraser");
        break;
    }
  };

  const handleKeyUp = (e: KeyboardEvent) => {
    if (e.code === "Space") spacePressed = false;
  };

  interactiveCanvas.addEventListener("mousedown", handleMouseDown);
  interactiveCanvas.addEventListener("mouseup", handleMouseUp);
  interactiveCanvas.addEventListener("mousemove", handleMouseMove);
  interactiveCanvas.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  renderStatic();

  return () => {
    if (rafId !== null) {
      cancelAnimationFrame(rafId);
    }
    socket.removeEventListener("message", onMessage);
    interactiveCanvas.removeEventListener("mousedown", handleMouseDown);
    interactiveCanvas.removeEventListener("mouseup", handleMouseUp);
    interactiveCanvas.removeEventListener("mousemove", handleMouseMove);
    interactiveCanvas.removeEventListener("wheel", handleWheel);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}

function isPointNearShapeBorder(
  p: Point,
  x: number,
  y: number,
  width: number,
  height: number,
  threshold: number
): boolean {
  const distToLeft = Math.abs(p.x - x);
  const distToRight = Math.abs(p.x - (x + width));
  const distToTop = Math.abs(p.y - y);
  const distToBottom = Math.abs(p.y - (y + height));

  const insideX = p.x >= x && p.x <= x + width;
  const insideY = p.y >= y && p.y <= y + height;

  if (insideX && insideY) return true;

  if (insideX) {
    return distToTop <= threshold || distToBottom <= threshold;
  }
  if (insideY) {
    return distToLeft <= threshold || distToRight <= threshold;
  }

  const distToTopLeft = Math.sqrt((p.x - x) ** 2 + (p.y - y) ** 2);
  const distToTopRight = Math.sqrt((p.x - (x + width)) ** 2 + (p.y - y) ** 2);
  const distToBottomLeft = Math.sqrt(
    (p.x - x) ** 2 + (p.y - (y + height)) ** 2
  );
  const distToBottomRight = Math.sqrt(
    (p.x - (x + width)) ** 2 + (p.y - (y + height)) ** 2
  );

  return (
    distToTopLeft <= threshold ||
    distToTopRight <= threshold ||
    distToBottomLeft <= threshold ||
    distToBottomRight <= threshold
  );
}

function getTextBounds(text: string, fontSize: number): { width: number; height: number } {
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) return { width: 100, height: 20 };
  ctx.font = `${fontSize}px sans-serif`;
  const metrics = ctx.measureText(text);
  return {
    width: metrics.width,
    height: fontSize,
  };
}

function isPointInShape(p: Point, s: Shape, zoom: number = 1): boolean {
  const hitThreshold = 8 / zoom;

  switch (s.type) {
    case "rect":
    case "diamond":
      return isPointNearShapeBorder(p, s.x, s.y, s.width, s.height, hitThreshold);
    case "circle":
      const d = Math.sqrt((p.x - s.centerX) ** 2 + (p.y - s.centerY) ** 2);
      return d <= s.radius;
    case "text": {
      const bounds = getTextBounds(s.text, 20);
      return isPointNearShapeBorder(p, s.x, s.y - bounds.height, bounds.width, bounds.height, hitThreshold);
    }
    case "pencil":
      return s.points.some(
        (pt) => Math.sqrt((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2) < hitThreshold
      );
    case "arrow":
    case "line":
      return (
        distToSegment(
          p,
          { x: s.startX, y: s.startY },
          { x: s.endX, y: s.endY }
        ) < hitThreshold
      );
  }
  return false;
}

function distToSegment(p: Point, v: Point, w: Point) {
  const l2 = (v.x - w.x) ** 2 + (v.y - w.y) ** 2;
  if (l2 === 0) return Math.sqrt((p.x - v.x) ** 2 + (p.y - v.y) ** 2);
  let t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
  t = Math.max(0, Math.min(1, t));
  return Math.sqrt(
    (p.x - (v.x + t * (w.x - v.x))) ** 2 + (p.y - (v.y + t * (w.y - v.y))) ** 2
  );
}

function getShapeBounds(shape: Shape): { minX: number; minY: number; maxX: number; maxY: number } {
  switch (shape.type) {
    case "rect":
    case "diamond":
      return {
        minX: shape.x,
        minY: shape.y,
        maxX: shape.x + shape.width,
        maxY: shape.y + shape.height,
      };
    case "text": {
      const bounds = getTextBounds(shape.text, 20);
      return {
        minX: shape.x,
        minY: shape.y - bounds.height,
        maxX: shape.x + bounds.width,
        maxY: shape.y,
      };
    }
    case "circle":
      return {
        minX: shape.centerX - shape.radius,
        minY: shape.centerY - shape.radius,
        maxX: shape.centerX + shape.radius,
        maxY: shape.centerY + shape.radius,
      };
    case "arrow":
    case "line":
      return {
        minX: Math.min(shape.startX, shape.endX),
        minY: Math.min(shape.startY, shape.endY),
        maxX: Math.max(shape.startX, shape.endX),
        maxY: Math.max(shape.startY, shape.endY),
      };
    case "pencil": {
      const xs = shape.points.map((p) => p.x);
      const ys = shape.points.map((p) => p.y);
      return {
        minX: Math.min(...xs),
        minY: Math.min(...ys),
        maxX: Math.max(...xs),
        maxY: Math.max(...ys),
      };
    }
  }
}

function getViewportBounds(
  canvas: HTMLCanvasElement,
  zoom: number,
  camera: { x: number; y: number }
): { minX: number; minY: number; maxX: number; maxY: number } {
  const dpr = window.devicePixelRatio || 1;
  const width = canvas.width / dpr;
  const height = canvas.height / dpr;

  const minX = -camera.x / zoom;
  const minY = -camera.y / zoom;
  const maxX = (width - camera.x) / zoom;
  const maxY = (height - camera.y) / zoom;

  return { minX, minY, maxX, maxY };
}

function shapesIntersectViewport(
  shapeBounds: { minX: number; minY: number; maxX: number; maxY: number },
  viewportBounds: { minX: number; minY: number; maxX: number; maxY: number }
): boolean {
  return !(
    shapeBounds.maxX < viewportBounds.minX ||
    shapeBounds.minX > viewportBounds.maxX ||
    shapeBounds.maxY < viewportBounds.minY ||
    shapeBounds.minY > viewportBounds.maxY
  );
}

function renderStaticCanvas(
  existingShapes: Shape[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  zoom: number,
  camera: { x: number; y: number }
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  const viewportBounds = getViewportBounds(canvas, zoom, camera);
  const visibleShapes = existingShapes.filter((shape) => {
    const bounds = getShapeBounds(shape);
    const padding = 50;
    return shapesIntersectViewport(
      {
        minX: bounds.minX - padding,
        minY: bounds.minY - padding,
        maxX: bounds.maxX + padding,
        maxY: bounds.maxY + padding,
      },
      viewportBounds
    );
  });

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);

  visibleShapes.forEach((shape) => {
    const roughOpts = {
      stroke: shape.style.stroke,
      strokeWidth: shape.style.strokeWidth / zoom,
      fill:
        shape.style.backgroundColor !== "transparent"
          ? shape.style.backgroundColor
          : undefined,
      fillStyle: shape.style.fillStyle,
      roughness: shape.style.roughness,
      strokeLineDash:
        shape.style.strokeStyle === "dashed"
          ? [5, 5]
          : shape.style.strokeStyle === "dotted"
            ? [2, 2]
            : undefined,
    };

    if (shape.type === "rect") {
      rc.rectangle(shape.x, shape.y, shape.width, shape.height, roughOpts);
    } else if (shape.type === "circle") {
      rc.circle(shape.centerX, shape.centerY, shape.radius * 2, roughOpts);
    } else if (shape.type === "diamond") {
      rc.polygon(
        [
          [shape.x + shape.width / 2, shape.y],
          [shape.x + shape.width, shape.y + shape.height / 2],
          [shape.x + shape.width / 2, shape.y + shape.height],
          [shape.x, shape.y + shape.height / 2],
        ],
        roughOpts
      );
    } else if (shape.type === "arrow") {
      rc.line(shape.startX, shape.startY, shape.endX, shape.endY, roughOpts);
      const angle = Math.atan2(
        shape.endY - shape.startY,
        shape.endX - shape.startX
      );
      const headlen = 10 / zoom;
      rc.line(
        shape.endX,
        shape.endY,
        shape.endX - headlen * Math.cos(angle - Math.PI / 6),
        shape.endY - headlen * Math.sin(angle - Math.PI / 6),
        roughOpts
      );
      rc.line(
        shape.endX,
        shape.endY,
        shape.endX - headlen * Math.cos(angle + Math.PI / 6),
        shape.endY - headlen * Math.sin(angle + Math.PI / 6),
        roughOpts
      );
    } else if (shape.type === "line") {
      rc.line(shape.startX, shape.startY, shape.endX, shape.endY, roughOpts);
    } else if (shape.type === "pencil") {
      rc.linearPath(
        shape.points.map((p) => [p.x, p.y]),
        roughOpts
      );
    } else if (shape.type === "text") {
      ctx.fillStyle = shape.style.stroke;
      ctx.font = `${20 / zoom}px sans-serif`;
      ctx.fillText(shape.text, shape.x, shape.y);
    }
  });

  ctx.restore();
}

function renderInteractiveCanvas(
  existingShapes: Shape[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  zoom: number,
  camera: { x: number; y: number },
  selectedShapeId: string | null,
  collaborators: Record<string, { name: string; x: number; y: number }>
) {
  const dpr = window.devicePixelRatio || 1;
  ctx.clearRect(0, 0, canvas.width / dpr, canvas.height / dpr);

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);

  const selectedShape = existingShapes.find((s) => s.id === selectedShapeId);
  if (selectedShape) {
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1 / zoom;
    ctx.setLineDash([5, 5]);
    if (selectedShape.type === "rect" || selectedShape.type === "diamond") {
      ctx.strokeRect(
        selectedShape.x - 4,
        selectedShape.y - 4,
        selectedShape.width + 8,
        selectedShape.height + 8
      );
    } else if (selectedShape.type === "circle") {
      ctx.beginPath();
      ctx.arc(selectedShape.centerX, selectedShape.centerY, selectedShape.radius + 4, 0, Math.PI * 2);
      ctx.stroke();
    } else if (selectedShape.type === "text") {
      const bounds = getTextBounds(selectedShape.text, 20);
      ctx.strokeRect(
        selectedShape.x - 4,
        selectedShape.y - bounds.height - 4,
        bounds.width + 8,
        bounds.height + 8
      );
    } else if (selectedShape.type === "pencil") {
      const minX = Math.min(...selectedShape.points.map((p) => p.x));
      const minY = Math.min(...selectedShape.points.map((p) => p.y));
      const maxX = Math.max(...selectedShape.points.map((p) => p.x));
      const maxY = Math.max(...selectedShape.points.map((p) => p.y));
      ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
    } else if (selectedShape.type === "arrow" || selectedShape.type === "line") {
      const minX = Math.min(selectedShape.startX, selectedShape.endX);
      const minY = Math.min(selectedShape.startY, selectedShape.endY);
      const maxX = Math.max(selectedShape.startX, selectedShape.endX);
      const maxY = Math.max(selectedShape.startY, selectedShape.endY);
      ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
    }
    ctx.setLineDash([]);

    const handles = getHandles(selectedShape);
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#3b82f6";
    ctx.lineWidth = 1 / zoom;
    handles.forEach((h) => {
      ctx.beginPath();
      ctx.arc(h.x, h.y, 4 / zoom, 0, Math.PI * 2);
      ctx.fill();
      ctx.stroke();
    });
  }

  Object.entries(collaborators).forEach(([, pos]) => {
    ctx.fillStyle = "#3b82f6";
    ctx.beginPath();
    ctx.moveTo(pos.x, pos.y);
    ctx.lineTo(pos.x + 10 / zoom, pos.y + 15 / zoom);
    ctx.lineTo(pos.x + 15 / zoom, pos.y + 10 / zoom);
    ctx.closePath();
    ctx.fill();

    ctx.font = `${12 / zoom}px sans-serif`;
    ctx.fillText(pos.name, pos.x + 15 / zoom, pos.y + 25 / zoom);
  });

  ctx.restore();
}

function clearCanvas(
  existingShapes: Shape[],
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  rc: RoughCanvas,
  zoom: number,
  camera: { x: number; y: number },
  selectedShapeId: string | null,
  collaborators: Record<string, { name: string; x: number; y: number }>
) {
  renderStaticCanvas(existingShapes, canvas, ctx, rc, zoom, camera);
}

async function getExistingShapes(roomId: string) {
  try {
    const res = await axios.get(`${HTTP_BACKEND}/shapes/${roomId}`);
    return res.data.shapes.map((s: { data: Shape }) => s.data);
  } catch (e) {
    console.error("Failed to fetch existing shapes", e);
    return [];
  }
}
function getHandles(s: Shape): { id: string; x: number; y: number }[] {
  if (s.type === "rect" || s.type === "diamond") {
    return [
      { id: "tl", x: s.x, y: s.y },
      { id: "tr", x: s.x + s.width, y: s.y },
      { id: "bl", x: s.x, y: s.y + s.height },
      { id: "br", x: s.x + s.width, y: s.y + s.height },
      { id: "tc", x: s.x + s.width / 2, y: s.y },
      { id: "bc", x: s.x + s.width / 2, y: s.y + s.height },
      { id: "lc", x: s.x, y: s.y + s.height / 2 },
      { id: "rc", x: s.x + s.width, y: s.y + s.height / 2 },
    ];
  }
  if (s.type === "circle") {
    return [
      { id: "t", x: s.centerX, y: s.centerY - s.radius },
      { id: "b", x: s.centerX, y: s.centerY + s.radius },
      { id: "l", x: s.centerX - s.radius, y: s.centerY },
      { id: "r", x: s.centerX + s.radius, y: s.centerY },
    ];
  }
  if (s.type === "arrow" || s.type === "line") {
    return [
      { id: "start", x: s.startX, y: s.startY },
      { id: "end", x: s.endX, y: s.endY },
    ];
  }
  return [];
}

function resizeShape(
  s: Shape,
  initial: Shape,
  handle: string,
  pos: Point
): Shape {
  if (
    (s.type === "rect" || s.type === "diamond") &&
    (initial.type === "rect" || initial.type === "diamond")
  ) {
    let { x, y, width, height } = initial;
    if (handle.includes("t")) {
      y = pos.y;
      height = initial.y + initial.height - pos.y;
    }
    if (handle.includes("b")) {
      height = pos.y - initial.y;
    }
    if (handle.includes("l")) {
      x = pos.x;
      width = initial.x + initial.width - pos.x;
    }
    if (handle.includes("r")) {
      width = pos.x - initial.x;
    }
    return { ...s, x, y, width, height };
  }
  if (s.type === "circle" && initial.type === "circle") {
    const radius = Math.sqrt(
      (pos.x - s.centerX) ** 2 + (pos.y - s.centerY) ** 2
    );
    return { ...s, radius };
  }
  if (
    (s.type === "arrow" || s.type === "line") &&
    (initial.type === "arrow" || initial.type === "line")
  ) {
    if (handle === "start") return { ...s, startX: pos.x, startY: pos.y };
    if (handle === "end") return { ...s, endX: pos.x, endY: pos.y };
  }
  return s;
}

function exportToPNG(canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const link = document.createElement("a");
  link.download = "excalidraw-export.png";
  link.href = canvas.toDataURL("image/png");
  link.click();
}

function exportToSVG(shapes: Shape[], canvas: HTMLCanvasElement | null) {
  if (!canvas) return;
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", canvas.width.toString());
  svg.setAttribute("height", canvas.height.toString());
  svg.setAttribute("viewBox", `0 0 ${canvas.width} ${canvas.height}`);
  svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");

  const rc = rough.svg(svg);

  shapes.forEach((shape) => {
    let node: SVGElement | null = null;
    const style = {
      stroke: shape.style.stroke,
      strokeWidth: shape.style.strokeWidth,
      fill: shape.style.stroke, // Use stroke color for fill if needed, or handle fillStyle
      fillStyle: shape.style.fillStyle,
    };

    if (shape.type === "rect") {
      node = rc.rectangle(shape.x, shape.y, shape.width, shape.height, style);
    } else if (shape.type === "circle") {
      node = rc.circle(shape.centerX, shape.centerY, shape.radius * 2, style);
    } else if (shape.type === "diamond") {
      const points: [number, number][] = [
        [shape.x + shape.width / 2, shape.y],
        [shape.x + shape.width, shape.y + shape.height / 2],
        [shape.x + shape.width / 2, shape.y + shape.height],
        [shape.x, shape.y + shape.height / 2],
      ];
      node = rc.polygon(points, style);
    } else if (shape.type === "arrow") {
      node = rc.line(shape.startX, shape.startY, shape.endX, shape.endY, style);
      // Simplified arrow head for SVG export
      const angle = Math.atan2(
        shape.endY - shape.startY,
        shape.endX - shape.startX
      );
      const headLen = 15;
      const p1: [number, number] = [
        shape.endX - headLen * Math.cos(angle - Math.PI / 6),
        shape.endY - headLen * Math.sin(angle - Math.PI / 6),
      ];
      const p2: [number, number] = [
        shape.endX - headLen * Math.cos(angle + Math.PI / 6),
        shape.endY - headLen * Math.sin(angle + Math.PI / 6),
      ];
      svg.appendChild(rc.line(shape.endX, shape.endY, p1[0], p1[1], style));
      svg.appendChild(rc.line(shape.endX, shape.endY, p2[0], p2[1], style));
    } else if (shape.type === "line") {
      node = rc.line(shape.startX, shape.startY, shape.endX, shape.endY, style);
    } else if (shape.type === "pencil") {
      const points: [number, number][] = shape.points.map((p) => [p.x, p.y]);
      node = rc.curve(points, style);
    } else if (shape.type === "text") {
      const text = document.createElementNS(
        "http://www.w3.org/2000/svg",
        "text"
      );
      text.setAttribute("x", shape.x.toString());
      text.setAttribute("y", shape.y.toString());
      text.setAttribute("fill", shape.style.stroke);
      text.setAttribute("font-family", "Inter, sans-serif");
      text.setAttribute("font-size", "20px");
      text.textContent = shape.text;
      svg.appendChild(text);
    }

    if (node) {
      svg.appendChild(node);
    }
  });

  const svgData = new XMLSerializer().serializeToString(svg);
  const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
  const svgUrl = URL.createObjectURL(svgBlob);
  const downloadLink = document.createElement("a");
  downloadLink.href = svgUrl;
  downloadLink.download = "excalidraw-export.svg";
  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);
}
