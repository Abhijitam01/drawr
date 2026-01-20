"use client";

import { useEffect, useRef, useState, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { useAuth } from "../context/AuthContext";
import { HTTP_BACKEND, WS_BACKEND } from "@/config";
import axios from "axios";
import { Toolbar, Tool } from "../components/canvas/Toolbar";
import { ZoomControls } from "../components/canvas/ZoomControls";
import { MainMenu } from "../components/canvas/MainMenu";
import { PropertyBar, FillStyle } from "../components/canvas/PropertyBar";
import rough from "roughjs";
import { RoughCanvas } from "roughjs/bin/canvas";

type Point = { x: number; y: number };

type ShapeStyle = {
  stroke: string;
  strokeWidth: number;
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

  const searchParams = useSearchParams();
  const roomId = searchParams.get("roomId") || "1";
  const { token } = useAuth();

  // Styling state
  const [strokeColor, setStrokeColor] = useState("#ECECEC");
  const [fillStyle, setFillStyle] = useState<FillStyle>("hachure");

  const socketRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (!token) return;
    const ws = new WebSocket(`${WS_BACKEND}?token=${token}`);
    socketRef.current = ws;

    const handleResize = () => {
      if (canvasRef.current) {
        canvasRef.current.width = window.innerWidth;
        canvasRef.current.height = window.innerHeight;
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

  useEffect(() => {
    shapesRef.current = shapes;
  }, [shapes]);

  useEffect(() => {
    collaboratorsRef.current = collaborators;
  }, [collaborators]);

  useEffect(() => {
    let cleanup: (() => void) | undefined;
    if (canvasRef.current && socketRef.current) {
      cleanup = initDraw(
        canvasRef.current,
        roomId,
        socketRef.current,
        selectedTool,
        zoom,
        camera,
        { stroke: strokeColor, strokeWidth: 2, fillStyle },
        (newShapes) => {
          setHistory((prev) => [...prev, newShapes]);
          setRedoStack([]);
          setShapes(newShapes);
        },
        (newZoom, newCamera) => {
          setZoom(newZoom);
          setCamera(newCamera);
        },
        (tool) => setSelectedTool(tool),
        selectedShapeId,
        setSelectedShapeId,
        setCollaborators,
        setOnlineUsers,
        shapesRef,
        setShapes,
        collaboratorsRef
      );
    }
    return () => {
      cleanup?.();
    };
  }, [
    selectedTool,
    zoom,
    camera,
    strokeColor,
    fillStyle,
    selectedShapeId,
    roomId,
    token,
  ]);

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
        fillStyle={fillStyle}
        setFillStyle={setFillStyle}
      />

      <ZoomControls
        zoom={zoom}
        setZoom={setZoom}
        undo={undo}
        redo={redo}
        canUndo={history.length > 0}
        canRedo={redoStack.length > 0}
      />

      <canvas ref={canvasRef} className="h-full w-full cursor-crosshair" />

      <div className="fixed top-6 right-6 flex flex-col gap-2">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 backdrop-blur-md">
          <h3 className="mb-2 text-[10px] font-bold tracking-widest text-zinc-500 uppercase">
            Online Users
          </h3>
          <div className="flex flex-col gap-2">
            {onlineUsers.map((u) => (
              <div key={u.userId} className="flex items-center gap-2">
                <div className="h-2 w-2 rounded-full bg-green-500" />
                <span className="text-xs font-medium text-zinc-300">
                  {u.name}
                </span>
              </div>
            ))}
          </div>
        </div>
        <button
          onClick={() => exportToPNG(canvasRef.current)}
          className="rounded-xl bg-zinc-100 px-4 py-2 text-xs font-bold text-zinc-900 transition-colors hover:bg-zinc-200"
        >
          Export PNG
        </button>
        <button
          onClick={() => exportToSVG(shapes, canvasRef.current)}
          className="rounded-xl border border-zinc-800 bg-zinc-900 px-4 py-2 text-xs font-bold text-zinc-100 transition-colors hover:bg-zinc-800"
        >
          Export SVG
        </button>
      </div>

      <div className="pointer-events-none fixed bottom-6 left-6 text-[10px] font-medium tracking-widest text-zinc-500 uppercase">
        Space + Drag to Pan • Scroll to Zoom
      </div>
    </div>
  );
}

function initDraw(
  canvas: HTMLCanvasElement,
  roomId: string,
  socket: WebSocket,
  selectedTool: Tool,
  zoom: number,
  camera: { x: number; y: number },
  currentStyle: ShapeStyle,
  onShapesUpdate: (shapes: Shape[]) => void,
  onCameraUpdate: (zoom: number, camera: { x: number; y: number }) => void,
  onToolSelect: (tool: Tool) => void,
  selectedShapeId: string | null,
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
  >
) {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const rc = rough.canvas(canvas);

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

  getExistingShapes(roomId).then((s) => {
    setShapes(s);
  });

  socket.send(JSON.stringify({ type: "join_room", roomId }));

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
      render();
    } else if (message.type === "user_list") {
      setOnlineUsers(message.users);
    }
  };

  socket.addEventListener("message", onMessage);

  const getMousePos = (e: MouseEvent) => {
    return {
      x: (e.clientX - camera.x) / zoom,
      y: (e.clientY - camera.y) / zoom,
    };
  };

  const render = () => {
    clearCanvas(
      shapesRef.current,
      canvas,
      ctx,
      rc,
      zoom,
      camera,
      selectedShapeId,
      collaboratorsRef.current
    );
  };

  const handleMouseDown = (e: MouseEvent) => {
    if (spacePressed || e.button === 1) {
      isPanning = true;
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }

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
        render();
      }
      return;
    }

    const pos = getMousePos(e);

    if (selectedTool === "select") {
      // Check handles first
      if (selectedShapeId) {
        const shape = shapesRef.current.find((s) => s.id === selectedShapeId);
        if (shape) {
          const handles = getHandles(shape);
          const handle = handles.find(
            (h) =>
              Math.sqrt((h.x - pos.x) ** 2 + (h.y - pos.y) ** 2) < 10 / zoom
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

      const shape = [...shapesRef.current]
        .reverse()
        .find((s) => isPointInShape(pos, s));
      if (shape) {
        setSelectedShapeId(shape.id);
        clicked = true;
        dragStart = pos;
        initialShapePos = JSON.parse(JSON.stringify(shape));
      } else {
        setSelectedShapeId(null);
      }
      render();
      return;
    }

    if (selectedTool === "eraser") {
      const shapeToDelete = shapesRef.current.find((s) =>
        isPointInShape(pos, s)
      );
      if (shapeToDelete) {
        const newShapes = shapesRef.current.filter(
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
        render();
      }
      return;
    }

    if (selectedTool === "text") {
      const text = prompt("Enter text:");
      if (text) {
        const shape: Shape = {
          id: Math.random().toString(36).substr(2, 9),
          type: "text",
          x: pos.x,
          y: pos.y,
          text,
          style: currentStyle,
        };
        const newShapes = [...shapesRef.current, shape];
        setShapes(newShapes);
        onShapesUpdate(newShapes);
        socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ shape }),
            roomId,
          })
        );
        render();
      }
      return;
    }

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

    if (selectedTool === "select" && selectedShapeId && dragStart) {
      const movedShape = shapesRef.current.find(
        (s) => s.id === selectedShapeId
      );
      if (movedShape) {
        onShapesUpdate(shapesRef.current);
        socket.send(
          JSON.stringify({
            type: "chat",
            message: JSON.stringify({ type: "update", shape: movedShape }),
            roomId,
          })
        );
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

    const newShapes = [...shapesRef.current, shape];
    setShapes(newShapes);
    onShapesUpdate(newShapes);

    socket.send(
      JSON.stringify({
        type: "chat",
        message: JSON.stringify({ shape }),
        roomId,
      })
    );
    render();
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (isPanning) {
      const dx = e.clientX - lastPanX;
      const dy = e.clientY - lastPanY;
      onCameraUpdate(zoom, { x: camera.x + dx, y: camera.y + dy });
      lastPanX = e.clientX;
      lastPanY = e.clientY;
      return;
    }

    if (clicked) {
      const pos = getMousePos(e);

      if (
        selectedTool === "select" &&
        selectedShapeId &&
        dragStart &&
        initialShapePos
      ) {
        const dx = pos.x - dragStart.x;
        const dy = pos.y - dragStart.y;
        const initialPos = initialShapePos;

        const newShapes = shapesRef.current.map((s) => {
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
        setShapes(newShapes);
        render();
        return;
      }

      render();

      ctx.save();
      ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);

      const width = pos.x - startX;
      const height = pos.y - startY;

      const roughOpts = {
        stroke: "#A5A5A5",
        strokeWidth: 2 / zoom,
        roughness: 1,
      };

      if (selectedTool === "rect") {
        rc.rectangle(startX, startY, width, height, roughOpts);
      } else if (selectedTool === "circle") {
        const radius = Math.sqrt(width * width + height * height);
        rc.circle(startX, startY, radius * 2, roughOpts);
      } else if (selectedTool === "diamond") {
        rc.polygon(
          [
            [startX + width / 2, startY],
            [startX + width, startY + height / 2],
            [startX + width / 2, startY + height],
            [startX, startY + height / 2],
          ],
          roughOpts
        );
      } else if (selectedTool === "arrow") {
        rc.line(startX, startY, pos.x, pos.y, roughOpts);
        // Simple arrow head
        const angle = Math.atan2(pos.y - startY, pos.x - startX);
        const headlen = 10 / zoom;
        rc.line(
          pos.x,
          pos.y,
          pos.x - headlen * Math.cos(angle - Math.PI / 6),
          pos.y - headlen * Math.sin(angle - Math.PI / 6),
          roughOpts
        );
        rc.line(
          pos.x,
          pos.y,
          pos.x - headlen * Math.cos(angle + Math.PI / 6),
          pos.y - headlen * Math.sin(angle + Math.PI / 6),
          roughOpts
        );
      } else if (selectedTool === "line") {
        rc.line(startX, startY, pos.x, pos.y, roughOpts);
      } else if (selectedTool === "pencil") {
        currentPencilPoints.push({ x: pos.x, y: pos.y });
        if (currentPencilPoints.length > 1) {
          rc.linearPath(
            currentPencilPoints.map((p) => [p.x, p.y]),
            roughOpts
          );
        }
      }
      ctx.restore();
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

  canvas.addEventListener("mousedown", handleMouseDown);
  canvas.addEventListener("mouseup", handleMouseUp);
  canvas.addEventListener("mousemove", handleMouseMove);
  canvas.addEventListener("wheel", handleWheel, { passive: false });
  window.addEventListener("keydown", handleKeyDown);
  window.addEventListener("keyup", handleKeyUp);

  return () => {
    socket.removeEventListener("message", onMessage);
    canvas.removeEventListener("mousedown", handleMouseDown);
    canvas.removeEventListener("mouseup", handleMouseUp);
    canvas.removeEventListener("mousemove", handleMouseMove);
    canvas.removeEventListener("wheel", handleWheel);
    window.removeEventListener("keydown", handleKeyDown);
    window.removeEventListener("keyup", handleKeyUp);
  };
}

function isPointInShape(p: Point, s: Shape): boolean {
  switch (s.type) {
    case "rect":
    case "diamond":
      return (
        p.x >= s.x &&
        p.x <= s.x + s.width &&
        p.y >= s.y &&
        p.y <= s.y + s.height
      );
    case "circle":
      const d = Math.sqrt((p.x - s.centerX) ** 2 + (p.y - s.centerY) ** 2);
      return d <= s.radius;
    case "text":
      return p.x >= s.x && p.x <= s.x + 100 && p.y >= s.y - 20 && p.y <= s.y;
    case "pencil":
      return s.points.some(
        (pt) => Math.sqrt((pt.x - p.x) ** 2 + (pt.y - p.y) ** 2) < 5
      );
    case "arrow":
    case "line":
      return (
        distToSegment(
          p,
          { x: s.startX, y: s.startY },
          { x: s.endX, y: s.endY }
        ) < 5
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
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = "#121212";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.save();
  ctx.setTransform(zoom, 0, 0, zoom, camera.x, camera.y);

  existingShapes.forEach((shape) => {
    const roughOpts = {
      stroke: shape.style.stroke,
      strokeWidth: shape.style.strokeWidth / zoom,
      fill:
        shape.style.fillStyle !== "hachure" ? shape.style.stroke : undefined,
      fillStyle: shape.style.fillStyle,
      roughness: 1,
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

    if (shape.id === selectedShapeId) {
      ctx.strokeStyle = "#3b82f6";
      ctx.lineWidth = 1 / zoom;
      ctx.setLineDash([5, 5]);
      if (shape.type === "rect" || shape.type === "diamond") {
        ctx.strokeRect(
          shape.x - 4,
          shape.y - 4,
          shape.width + 8,
          shape.height + 8
        );
      } else if (shape.type === "circle") {
        ctx.beginPath();
        ctx.arc(shape.centerX, shape.centerY, shape.radius + 4, 0, Math.PI * 2);
        ctx.stroke();
      } else if (shape.type === "text") {
        ctx.strokeRect(shape.x - 4, shape.y - 24, 108, 28);
      } else if (shape.type === "pencil") {
        const minX = Math.min(...shape.points.map((p) => p.x));
        const minY = Math.min(...shape.points.map((p) => p.y));
        const maxX = Math.max(...shape.points.map((p) => p.x));
        const maxY = Math.max(...shape.points.map((p) => p.y));
        ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
      } else if (shape.type === "arrow" || shape.type === "line") {
        const minX = Math.min(shape.startX, shape.endX);
        const minY = Math.min(shape.startY, shape.endY);
        const maxX = Math.max(shape.startX, shape.endX);
        const maxY = Math.max(shape.startY, shape.endY);
        ctx.strokeRect(minX - 4, minY - 4, maxX - minX + 8, maxY - minY + 8);
      }
      ctx.setLineDash([]);

      // Draw handles
      const handles = getHandles(shape);
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
  });

  // Draw collaborator cursors
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

async function getExistingShapes(roomId: string) {
  try {
    const res = await axios.get(`${HTTP_BACKEND}/chats/${roomId}`);
    const messages = res.data.messages;
    return messages.reduce((acc: Shape[], x: { message: string }) => {
      const messageData = JSON.parse(x.message);
      if (messageData.type === "clear") return [];
      if (messageData.type === "delete")
        return acc.filter((s) => s.id !== messageData.id);
      if (messageData.type === "update")
        return acc.map((s) =>
          s.id === messageData.shape.id ? messageData.shape : s
        );
      if (messageData.shape) acc.push(messageData.shape);
      return acc;
    }, []);
  } catch (e) {
    console.error("Failed to fetch shapes", e);
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
