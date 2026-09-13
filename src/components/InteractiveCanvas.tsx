import React, { useState, useRef, useEffect, useMemo } from "react";
import { fabric } from "fabric";
import { 
  Paintbrush, 
  Square, 
  ArrowRight, 
  Type, 
  Trash2, 
  RotateCcw, 
  RotateCw,
  Plus, 
  Sparkles, 
  Check, 
  X, 
  Activity, 
  HelpCircle,
  Save,
  DollarSign,
  Grid,
  TrendingUp,
  Sliders,
  Scale,
  Eraser
} from "lucide-react";
import { saveTrade } from "../lib/db";

// Extend Fabric Object interface for TypeScript compiled environment
interface ExtendedFabricObject extends fabric.Object {
  id?: string;
  name?: string;
  isAiLayer?: boolean;
}

interface InteractiveCanvasProps {
  imageUrl: string;
  onSaveComposite: (compositeUrl: string) => void;
  analysisResult?: any;
}

export default function InteractiveCanvas({ 
  imageUrl, 
  onSaveComposite,
  analysisResult 
}: InteractiveCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fabricCanvasRef = useRef<fabric.Canvas | null>(null);

  // Layout Canvas settings
  const canvasWidth = 820;
  const canvasHeight = 490;

  // Tools & custom choices
  const [activeTool, setActiveTool] = useState<"free" | "rect" | "line" | "trendline" | "arrow" | "text" | "eraser" | "none">("none");
  const [color, setColor] = useState<string>("#22d3ee"); // Default cyan accent
  const [opacity, setOpacity] = useState<number>(0.8);
  const [brushSize, setBrushSize] = useState<number>(3);
  const [redoStack, setRedoStack] = useState<fabric.Object[]>([]);
  const [imageLoaded, setImageLoaded] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Manual input override values (synchronized with drawn elements)
  const [entryPrice, setEntryPrice] = useState<number>(1000);
  const [stopLossPrice, setStopLossPrice] = useState<number>(950);
  const [tp1Price, setTp1Price] = useState<number>(1100);
  const [tp2Price, setTp2Price] = useState<number>(1200);

  // Custom trade setup info
  const [tradeNotes, setTradeNotes] = useState<string>("");

  // Extract prices from AI response to build our TradingView-style relative Y-scale mapping
  const pricesList = useMemo(() => {
    const list: number[] = [];
    if (analysisResult?.tradeSetup) {
      if (typeof analysisResult.tradeSetup.entry === "number") list.push(analysisResult.tradeSetup.entry);
      if (typeof analysisResult.tradeSetup.stopLoss === "number") list.push(analysisResult.tradeSetup.stopLoss);
      if (Array.isArray(analysisResult.tradeSetup.takeProfits)) {
        analysisResult.tradeSetup.takeProfits.forEach((v: any) => {
          if (typeof v === "number") list.push(v);
        });
      }
    }

    // Helper to parse double numbers from range strings e.g. "1550 - 1580"
    const parseRangeNumbers = (rangeStr: string) => {
      if (!rangeStr) return;
      const matches = rangeStr.match(/\d+[\.\d]*/g);
      if (matches) {
        matches.forEach((m) => {
          const val = parseFloat(m);
          if (!isNaN(val) && val > 0) list.push(val);
        });
      }
    };

    if (analysisResult?.orderBlock?.priceRange) parseRangeNumbers(analysisResult.orderBlock.priceRange);
    if (analysisResult?.supplyDemandZones?.supply) parseRangeNumbers(analysisResult.supplyDemandZones.supply);
    if (analysisResult?.supplyDemandZones?.demand) parseRangeNumbers(analysisResult.supplyDemandZones.demand);
    if (analysisResult?.liquidityVoid?.priceRange) parseRangeNumbers(analysisResult.liquidityVoid.priceRange);
    if (analysisResult?.vacuumBlock?.priceRange) parseRangeNumbers(analysisResult.vacuumBlock.priceRange);

    const filtered = list.filter((v) => !isNaN(v) && v > 0);
    if (filtered.length === 0) {
      // Fallback relative scale reference points
      return [900, 1000, 1100, 1200, 1300];
    }
    return filtered;
  }, [analysisResult]);

  // Compute scale boundaries
  const { minPrice, maxPrice, paddedMin, paddedMax } = useMemo(() => {
    const minVal = Math.min(...pricesList);
    const maxVal = Math.max(...pricesList);
    const diff = maxVal - minVal || 100;
    // Add 16% safety padding for top and bottom margin grid alignment
    const padMin = Math.max(0.1, minVal - diff * 0.16);
    const padMax = maxVal + diff * 0.16;
    return {
      minPrice: minVal,
      maxPrice: maxVal,
      paddedMin: padMin,
      paddedMax: padMax,
    };
  }, [pricesList]);

  // Convert a target price to canvas Y coordinate
  const getCanvasY = (price: number): number => {
    if (paddedMax === paddedMin) return canvasHeight / 2;
    const ratio = (paddedMax - price) / (paddedMax - paddedMin);
    return Math.max(5, Math.min(canvasHeight - 5, ratio * canvasHeight));
  };

  // Convert a canvas Y coordinate back to target price
  const getPriceFromY = (y: number): number => {
    const ratio = y / canvasHeight;
    return paddedMax - ratio * (paddedMax - paddedMin);
  };

  // Set initial state override inputs once AI results load
  useEffect(() => {
    if (analysisResult?.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      if (ts.entry) setEntryPrice(Number(ts.entry));
      if (ts.stopLoss) setStopLossPrice(Number(ts.stopLoss));
      if (Array.isArray(ts.takeProfits)) {
        if (ts.takeProfits[0]) setTp1Price(Number(ts.takeProfits[0]));
        if (ts.takeProfits[1]) setTp2Price(Number(ts.takeProfits[1]));
        else setTp2Price(Number(ts.takeProfits[0]) * 1.05); // dynamic default offset
      }
    }
  }, [analysisResult]);

  // Handle building and syncing interactive Fabric Canvas
  useEffect(() => {
    if (!canvasRef.current) return;

    // 1. Initialize Canvas
    const canvas = new fabric.Canvas(canvasRef.current, {
      width: canvasWidth,
      height: canvasHeight,
      backgroundColor: "#0d1322",
      selection: true,
    });
    fabricCanvasRef.current = canvas;

    // 2. Load background chart image
    if (!imageUrl || imageUrl.trim() === "") {
      setImageLoaded(true);
      if (analysisResult) {
        drawAiStructures(canvas);
      }
    } else {
      const imgElement = new Image();
      imgElement.crossOrigin = "anonymous";
      imgElement.onload = () => {
        setImageLoaded(true);
        
        const scaleX = canvasWidth / imgElement.width;
        const scaleY = canvasHeight / imgElement.height;
        const scale = Math.min(scaleX, scaleY);
        
        const left = (canvasWidth - imgElement.width * scale) / 2;
        const top = (canvasHeight - imgElement.height * scale) / 2;

        const fabricImg = new fabric.Image(imgElement, {
          left: left,
          top: top,
          scaleX: scale,
          scaleY: scale,
          selectable: false,
          evented: false,
        });

        (canvas as any).setBackgroundImage(fabricImg, canvas.renderAll.bind(canvas));

        // 3. Render AI-detected structures automatically once background loads
        if (analysisResult) {
          drawAiStructures(canvas);
        }
      };
      
      imgElement.onerror = (err) => {
        console.warn("Failed to load background image in fabric interactive canvas:", err);
        setImageLoaded(true); // Fall back so UI continues to function
        if (analysisResult) {
          drawAiStructures(canvas);
        }
      };

      imgElement.src = imageUrl;
    }

    // 4. Interactivity Event: Listen to line displacement (Cast as any to bypass strict checks)
    canvas.on("object:moving", (options: any) => {
      const obj = options.target;
      if (!obj) return;

      // Restrict coordinate limits
      if (obj.id?.endsWith("_LINE")) {
        obj.set({ left: 0 }); // Lock horizontally
        const yCoord = obj.top || 0;
        const currentPrice = getPriceFromY(yCoord);

        // Sync textual inputs relative to active dragging
        if (obj.name === "ENTRY") setEntryPrice(Math.round(currentPrice * 10) / 10);
        else if (obj.name === "SL") setStopLossPrice(Math.round(currentPrice * 10) / 10);
        else if (obj.name === "TP1") setTp1Price(Math.round(currentPrice * 10) / 10);
        else if (obj.name === "TP2") setTp2Price(Math.round(currentPrice * 10) / 10);

        // Displace coordinate labels
        const labelObj = canvas.getObjects().find(
          (o: any) => o.id === obj.id?.replace("_LINE", "_LABEL")
        );
        if (labelObj) {
          labelObj.set({ top: yCoord - 18 });
        }
      }
    });

    // Cleanup on destroy
    return () => {
      canvas.dispose();
      fabricCanvasRef.current = null;
    };
  }, [imageUrl, analysisResult, paddedMin, paddedMax]);

  // Adjust active tools & stylus options on the Fabric instance
  useEffect(() => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (activeTool === "free") {
      canvas.isDrawingMode = true;
      // Initialize free brush stylus
      canvas.freeDrawingBrush = new fabric.PencilBrush(canvas);
      canvas.freeDrawingBrush.color = color;
      canvas.freeDrawingBrush.width = brushSize;
    } else {
      canvas.isDrawingMode = false;
      // Change pointer cursor
      if (activeTool === "none") {
        canvas.defaultCursor = "default";
      } else if (activeTool === "eraser") {
        canvas.defaultCursor = "not-allowed";
      } else {
        canvas.defaultCursor = "crosshair";
      }
    }

    // Set properties on click-and-drag shape listeners
    let isMouseDown = false;
    let startPoint: fabric.Point | null = null;
    let tempObject: fabric.Object | null = null;

    const handleMouseDown = (options: any) => {
      if (activeTool === "free" || activeTool === "none") return;
      const pointer = canvas.getPointer(options.e);

      if (activeTool === "eraser") {
        const target = options.target;
        if (target && !(target as ExtendedFabricObject).isAiLayer) {
          canvas.remove(target);
          canvas.discardActiveObject();
          canvas.renderAll();
          setRedoStack([]); // Clear redo since we modified structure
          updatePreviews();
        }
        return;
      }

      if (activeTool === "line") {
        const tempLine = new fabric.Line([0, pointer.y, canvasWidth, pointer.y], {
          stroke: color,
          strokeWidth: brushSize,
          strokeDashArray: [5, 4],
          selectable: true,
          hasControls: false, // drag up-down only
          lockMovementX: true, // restrict horizontal displacement
          hoverCursor: "ns-resize",
        } as any);
        canvas.add(tempLine);
        canvas.renderAll();
        setRedoStack([]); // Clear redo stack on new action
        updatePreviews();
        return;
      }

      isMouseDown = true;
      startPoint = new fabric.Point(pointer.x, pointer.y);

      if (activeTool === "rect") {
        tempObject = new fabric.Rect({
          left: pointer.x,
          top: pointer.y,
          width: 0,
          height: 0,
          fill: `${color}${Math.round(opacity * 255).toString(16).padStart(2, "0")}`,
          stroke: color,
          strokeWidth: brushSize,
          selectable: true,
          hasControls: true,
        });
        canvas.add(tempObject);
      } else if (activeTool === "arrow" || activeTool === "trendline") {
        // Line body
        tempObject = new fabric.Line([pointer.x, pointer.y, pointer.x, pointer.y], {
          stroke: color,
          strokeWidth: brushSize,
          selectable: true,
          hasControls: true, // Need controls for trendlines
        });
        canvas.add(tempObject);
      } else if (activeTool === "text") {
        const text = new fabric.IText("Double Click to Edit Label", {
          left: pointer.x,
          top: pointer.y - 10,
          fontFamily: "Space Grotesk, sans-serif",
          fontSize: 14,
          fill: color,
          fontWeight: "bold",
          backgroundColor: "rgba(15, 23, 42, 0.75)",
          padding: 4,
          selectable: true,
        });
        canvas.add(text);
        canvas.setActiveObject(text);
        text.enterEditing();
        setActiveTool("none"); // return to select
        isMouseDown = false;
        setRedoStack([]); // Clear redo stack
      }
    };

    const handleMouseMove = (options: any) => {
      if (!isMouseDown || !startPoint || !tempObject) return;
      const pointer = canvas.getPointer(options.e);

      if (activeTool === "rect") {
        const width = pointer.x - startPoint.x;
        const height = pointer.y - startPoint.y;
        tempObject.set({
          width: Math.abs(width),
          height: Math.abs(height),
          left: width < 0 ? pointer.x : startPoint.x,
          top: height < 0 ? pointer.y : startPoint.y,
        });
      } else if (activeTool === "arrow" || activeTool === "trendline") {
        const line = tempObject as fabric.Line;
        line.set({ x2: pointer.x, y2: pointer.y });
      }

      canvas.renderAll();
    };

    const handleMouseUp = () => {
      if (!isMouseDown) return;
      isMouseDown = false;

      // Handle arrow pointer cap drawings on finish
      if (activeTool === "arrow" && tempObject && startPoint) {
        const line = tempObject as fabric.Line;
        // Draw head
        const angle = Math.atan2((line.y2 || 0) - (line.y1 || 0), (line.x2 || 0) - (line.x1 || 0));
        const head = new fabric.Triangle({
          left: line.x2,
          top: line.y2,
          originX: "center",
          originY: "center",
          angle: (angle * 180) / Math.PI + 90,
          width: 14 + brushSize,
          height: 14 + brushSize,
          fill: color,
          selectable: true,
        });
        canvas.add(head);

        // Group them
        canvas.remove(line);
        canvas.remove(head);
        const group = new fabric.Group([line, head], {
          selectable: true,
          hasControls: true,
        });
        canvas.add(group);
      }

      tempObject = null;
      startPoint = null;
      
      setRedoStack([]); // Clear redo stack on new action
      // Auto-update composite preview URL to save state
      updatePreviews();
    };

    canvas.on("mouse:down", handleMouseDown);
    canvas.on("mouse:move", handleMouseMove);
    canvas.on("mouse:up", handleMouseUp);

    return () => {
      canvas.off("mouse:down", handleMouseDown);
      canvas.off("mouse:move", handleMouseMove);
      canvas.off("mouse:up", handleMouseUp);
    };
  }, [activeTool, color, opacity, brushSize]);

  // Sync manual inputs to the active levels on the canvas
  const syncInputsToCanvas = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const findAndUpdate = (name: string, price: number) => {
      const line = canvas.getObjects().find(
        (o: any) => o.name === name && o.id?.endsWith("_LINE")
      ) as fabric.Line;
      const label = canvas.getObjects().find(
        (o: any) => o.id === `${name}_LABEL`
      ) as fabric.Text;

      const y = getCanvasY(price);

      if (line) {
        line.set({ top: y, y1: y, y2: y });
        line.setCoords();
      }
      if (label) {
        label.set({ top: y - 18 });
        label.setCoords();
      }
    };

    findAndUpdate("ENTRY", entryPrice);
    findAndUpdate("SL", stopLossPrice);
    findAndUpdate("TP1", tp1Price);
    findAndUpdate("TP2", tp2Price);

    canvas.renderAll();
    updatePreviews();
  };

  // Run dynamic input synchronizer
  useEffect(() => {
    syncInputsToCanvas();
  }, [entryPrice, stopLossPrice, tp1Price, tp2Price, imageLoaded]);

  // Draw the highly professional AI mapped zones & metrics
  const drawAiStructures = (canvas: fabric.Canvas) => {
    if (!analysisResult) return;

    // Helper: Draw Order Block block
    if (analysisResult.orderBlock?.priceRange) {
      const range = parsePricesFromText(analysisResult.orderBlock.priceRange);
      if (range.length >= 2) {
        const yTop = getCanvasY(Math.max(...range));
        const yBottom = getCanvasY(Math.min(...range));
        const activeColor = analysisResult.bias === "BULLISH" ? "#10b981" : "#f43f5e";

        const rect = new fabric.Rect({
          left: canvasWidth * 0.15,
          top: yTop,
          width: canvasWidth * 0.55,
          height: Math.abs(yBottom - yTop) || 22,
          fill: analysisResult.bias === "BULLISH" ? "rgba(16, 185, 129, 0.12)" : "rgba(244, 63, 94, 0.12)",
          stroke: activeColor,
          strokeWidth: 1.5,
          strokeDashArray: [4, 4],
          selectable: false,
          evented: false,
        });

        const text = new fabric.Text(`AI ORDER BLOCK (${analysisResult.orderBlock.type || "Fresh"})`, {
          left: canvasWidth * 0.15 + 8,
          top: yTop + 4,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 9,
          fontWeight: "bold",
          fill: activeColor,
          selectable: false,
          evented: false,
        });

        // Mark tag properties
        (rect as any).isAiLayer = true;
        (text as any).isAiLayer = true;

        canvas.add(rect, text);
      }
    }

    // Helper: Draw Supply & Demand bounds
    if (analysisResult.supplyDemandZones) {
      const supply = parsePricesFromText(analysisResult.supplyDemandZones.supply);
      const demand = parsePricesFromText(analysisResult.supplyDemandZones.demand);

      if (supply.length >= 2) {
        const yTop = getCanvasY(Math.max(...supply));
        const yBottom = getCanvasY(Math.min(...supply));

        const rect = new fabric.Rect({
          left: 0,
          top: yTop,
          width: canvasWidth,
          height: Math.abs(yBottom - yTop) || 28,
          fill: "rgba(244, 63, 94, 0.08)",
          stroke: "rgba(244, 63, 94, 0.25)",
          strokeWidth: 1,
          selectable: false,
          evented: false,
        });

        const text = new fabric.Text(`SUPPLY ZONE (POI)`, {
          left: 15,
          top: yTop + 4,
          fontFamily: "Inter, sans-serif",
          fontSize: 9,
          fontWeight: "bold",
          fill: "#f43f5e",
          selectable: false,
          evented: false,
        });

        (rect as any).isAiLayer = true;
        (text as any).isAiLayer = true;
        canvas.add(rect, text);
      }

      if (demand.length >= 2) {
        const yTop = getCanvasY(Math.max(...demand));
        const yBottom = getCanvasY(Math.min(...demand));

        const rect = new fabric.Rect({
          left: 0,
          top: yTop,
          width: canvasWidth,
          height: Math.abs(yBottom - yTop) || 28,
          fill: "rgba(16, 185, 129, 0.08)",
          stroke: "rgba(16, 185, 129, 0.25)",
          strokeWidth: 1,
          selectable: false,
          evented: false,
        });

        const text = new fabric.Text(`DEMAND ZONE (POI)`, {
          left: 15,
          top: yTop + 4,
          fontFamily: "Inter, sans-serif",
          fontSize: 9,
          fontWeight: "bold",
          fill: "#10b981",
          selectable: false,
          evented: false,
        });

        (rect as any).isAiLayer = true;
        (text as any).isAiLayer = true;
        canvas.add(rect, text);
      }
    }

    // Draw Fair Value Gap (FVG) box near middle of range
    if (analysisResult.bias) {
      const avgPrice = (minPrice + maxPrice) / 2;
      const yFvg = getCanvasY(avgPrice);
      const fvgGlow = new fabric.Rect({
        left: canvasWidth * 0.35,
        top: yFvg - 10,
        width: canvasWidth * 0.25,
        height: 20,
        fill: "rgba(245, 158, 11, 0.07)",
        stroke: "rgba(245, 158, 11, 0.35)",
        strokeWidth: 1,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
      });

      const fvgLabel = new fabric.Text(`FVG IMBALANCE`, {
        left: canvasWidth * 0.35 + 8,
        top: yFvg - 7,
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 8,
        fontWeight: "bold",
        fill: "#f59e0b",
        selectable: false,
        evented: false,
      });

      (fvgGlow as any).isAiLayer = true;
      (fvgLabel as any).isAiLayer = true;
      canvas.add(fvgGlow, fvgLabel);
    }

    // Helper: Draw Liquidity Void (IMBALANCE / MAGNET)
    if (analysisResult.liquidityVoid?.priceRange) {
      const range = parsePricesFromText(analysisResult.liquidityVoid.priceRange);
      if (range.length >= 2) {
        const yTop = getCanvasY(Math.max(...range));
        const yBottom = getCanvasY(Math.min(...range));

        const rect = new fabric.Rect({
          left: canvasWidth * 0.1,
          top: yTop,
          width: canvasWidth * 0.8,
          height: Math.abs(yBottom - yTop) || 30,
          fill: "rgba(139, 92, 246, 0.08)",
          stroke: "rgba(139, 92, 246, 0.4)",
          strokeWidth: 1.5,
          strokeDashArray: [6, 4],
          selectable: false,
          evented: false,
        });

        const text = new fabric.Text(` [ AI LIQUIDITY VOID - MAGNET ] `, {
          left: canvasWidth * 0.1 + 10,
          top: yTop + 5,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 9,
          fontWeight: "bold",
          fill: "#a78bfa",
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          padding: 3,
          selectable: false,
          evented: false,
        });

        (rect as any).isAiLayer = true;
        (text as any).isAiLayer = true;
        canvas.add(rect, text);
      }
    }

    // Helper: Draw Vacuum Block (HIGH PRESSURE VOLATILITY REVERSION BOUND)
    if (analysisResult.vacuumBlock?.priceRange) {
      const range = parsePricesFromText(analysisResult.vacuumBlock.priceRange);
      if (range.length >= 2) {
        const yTop = getCanvasY(Math.max(...range));
        const yBottom = getCanvasY(Math.min(...range));

        const rect = new fabric.Rect({
          left: canvasWidth * 0.2,
          top: yTop,
          width: canvasWidth * 0.6,
          height: Math.abs(yBottom - yTop) || 32,
          fill: "rgba(245, 158, 11, 0.08)",
          stroke: "rgba(245, 158, 11, 0.4)",
          strokeWidth: 1.5,
          strokeDashArray: [2, 2],
          selectable: false,
          evented: false,
        });

        const text = new fabric.Text(` [ VACUUM BLOCK POI ] `, {
          left: canvasWidth * 0.2 + 10,
          top: yTop + 5,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 9,
          fontWeight: "bold",
          fill: "#f59e0b",
          backgroundColor: "rgba(15, 23, 42, 0.85)",
          padding: 3,
          selectable: false,
          evented: false,
        });

        (rect as any).isAiLayer = true;
        (text as any).isAiLayer = true;
        canvas.add(rect, text);
      }
    }

    // Helper: Draw Fibonacci Retracement Levels
    const fibLevels = [
      { key: "0.50", ratio: 0.50, label: "0.50 (Equilibrium)" },
      { key: "0.618", ratio: 0.618, label: "0.618 (Golden Pocket)" },
      { key: "0.786", ratio: 0.786, label: "0.786 (Deep Discount)" }
    ];

    fibLevels.forEach((level) => {
      const lPrice = paddedMax - level.ratio * (paddedMax - paddedMin);
      const y = getCanvasY(lPrice);

      const fibLine = new fabric.Line([0, y, canvasWidth, y], {
        stroke: "rgba(148, 163, 184, 0.45)",
        strokeWidth: 1,
        strokeDashArray: [3, 3],
        selectable: false,
        evented: false,
      });

      const fibText = new fabric.Text(`${level.label}: ${lPrice.toFixed(1)}`, {
        left: canvasWidth - 170,
        top: y - 11,
        fontFamily: "monospace",
        fontSize: 8,
        fill: "#94a3b8",
        selectable: false,
        evented: false,
      });

      (fibLine as any).isAiLayer = true;
      (fibText as any).isAiLayer = true;
      canvas.add(fibLine, fibText);
    });

    // Helper: Large floating bias direction trend arrows
    const isBull = analysisResult.bias === "BULLISH";
    const arrowColor = isBull ? "rgba(34, 211, 238, 0.08)" : "rgba(244, 63, 94, 0.08)";
    const arrowObj = new fabric.Line(
      isBull 
        ? [canvasWidth * 0.1, canvasHeight * 0.75, canvasWidth * 0.85, canvasHeight * 0.25]
        : [canvasWidth * 0.1, canvasHeight * 0.25, canvasWidth * 0.85, canvasHeight * 0.75],
      {
        stroke: arrowColor,
        strokeWidth: 26,
        selectable: false,
        evented: false,
      }
    );
    (arrowObj as any).isAiLayer = true;
    canvas.add(arrowObj);

    // AI SCANNER ADDITION 1: Trendlines for structure and BOS / CHOCH
    const ptA_x = canvasWidth * 0.12;
    const ptA_y = isBull ? canvasHeight * 0.78 : canvasHeight * 0.22;
    const ptB_x = canvasWidth * 0.42;
    const ptB_y = isBull ? canvasHeight * 0.38 : canvasHeight * 0.62;
    const ptC_x = canvasWidth * 0.58;
    const ptC_y = isBull ? canvasHeight * 0.52 : canvasHeight * 0.48;
    const ptD_x = canvasWidth * 0.82;
    const ptD_y = isBull ? canvasHeight * 0.18 : canvasHeight * 0.82;

    const trendline1 = new fabric.Line([ptA_x, ptA_y, ptB_x, ptB_y], {
      stroke: isBull ? "#22d3ee" : "#f43f5e",
      strokeWidth: 2,
      strokeDashArray: [4, 4],
      selectable: false,
      evented: false,
    });
    const trendline2 = new fabric.Line([ptB_x, ptB_y, ptC_x, ptC_y], {
      stroke: "rgba(148,163,184,0.6)",
      strokeWidth: 1.5,
      selectable: false,
      evented: false,
    });
    const trendline3 = new fabric.Line([ptC_x, ptC_y, ptD_x, ptD_y], {
      stroke: isBull ? "#34d399" : "#fb7185",
      strokeWidth: 2.5,
      selectable: false,
      evented: false,
    });

    // Draw horizontal dashed line across point B to label BOS / CHOCH breaker trigger level
    const bosLine = new fabric.Line([ptB_x - 30, ptB_y, ptD_x + 30, ptB_y], {
      stroke: "#a78bfa",
      strokeWidth: 1.5,
      strokeDashArray: [6, 4],
      selectable: false,
      evented: false,
    });

    const bosLabel = new fabric.Text(isBull ? "BOS [BREAK OF STRUCTURE]" : "CHoCH [CHANGE OF CHARACTER]", {
      left: ptB_x + 10,
      top: ptB_y - 14,
      fontFamily: "Space Grotesk, monospace",
      fontSize: 8,
      fontWeight: "bold",
      fill: "#c084fc",
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      padding: 2,
      selectable: false,
      evented: false,
    });

    (trendline1 as any).isAiLayer = true;
    (trendline2 as any).isAiLayer = true;
    (trendline3 as any).isAiLayer = true;
    (bosLine as any).isAiLayer = true;
    (bosLabel as any).isAiLayer = true;
    canvas.add(trendline1, trendline2, trendline3, bosLine, bosLabel);

    // AI SCANNER ADDITION 2: Highlight detected candlestick patterns at key zones with indicator ring
    if (analysisResult.candlestickPatterns?.patternName) {
      const ePrice = analysisResult.tradeSetup?.entry || (paddedMax + paddedMin) / 2;
      const targetY = getCanvasY(ePrice);
      const ring_x = canvasWidth * 0.45;
      const ring_y = targetY;

      const ringCircle = new fabric.Circle({
        left: ring_x - 14,
        top: ring_y - 14,
        radius: 14,
        fill: "rgba(34, 211, 238, 0.05)",
        stroke: "#22d3ee",
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
      });

      const patternLabel = new fabric.Text(`[CV DETECTED CONCURRENT: ${analysisResult.candlestickPatterns.patternName}]`, {
        left: ring_x + 22,
        top: ring_y - 10,
        fontFamily: "Space Grotesk, monospace",
        fontSize: 8,
        fontWeight: "bold",
        fill: "#22d3ee",
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        padding: 2,
        selectable: false,
        evented: false,
      });

      const patternPointer = new fabric.Line([ring_x, ring_y, ring_x + 20, ring_y - 4], {
        stroke: "#22d3ee",
        strokeWidth: 1.2,
        selectable: false,
        evented: false,
      });

      (ringCircle as any).isAiLayer = true;
      (patternLabel as any).isAiLayer = true;
      (patternPointer as any).isAiLayer = true;
      canvas.add(ringCircle, patternLabel, patternPointer);
    }

    // AI SCANNER ADDITION 3: Auto-generate fully interactive suggested level sliders on canvas load 
    const addInteractiveSMCLine = (name: string, activeColor: string, targetPrice: number) => {
      const y = getCanvasY(targetPrice);
      
      const lineObj = new fabric.Line([0, y, canvasWidth - 10, y], {
        id: `${name}_LINE`,
        name: name,
        stroke: activeColor,
        strokeWidth: 2.2,
        strokeDashArray: [6, 4],
        selectable: true,
        hasControls: false,
        lockMovementX: true,
        hoverCursor: "ns-resize",
      } as any);

      const labelObj = new fabric.Text(` [ ${name} LEVEL - ${targetPrice.toFixed(1)} ] `, {
        id: `${name}_LABEL`,
        left: 20,
        top: y - 18,
        fontFamily: "Space Grotesk, monospace",
        fontSize: 10,
        fontWeight: "bold",
        fill: activeColor,
        backgroundColor: "rgba(15, 23, 42, 0.9)",
        padding: 3,
        selectable: false,
        evented: false,
      } as any);

      canvas.add(lineObj, labelObj);
    };

    if (analysisResult.tradeSetup) {
      const ts = analysisResult.tradeSetup;
      if (ts.entry) addInteractiveSMCLine("ENTRY", "#22d3ee", Number(ts.entry));
      if (ts.stopLoss) addInteractiveSMCLine("SL", "#f43f5e", Number(ts.stopLoss));
      if (Array.isArray(ts.takeProfits)) {
        if (ts.takeProfits[0]) addInteractiveSMCLine("TP1", "#10b981", Number(ts.takeProfits[0]));
        if (ts.takeProfits[1]) addInteractiveSMCLine("TP2", "#34d399", Number(ts.takeProfits[1]));
        else addInteractiveSMCLine("TP2", "#34d399", Number(ts.takeProfits[0]) * 1.05);
      }
    }

    // AI SCANNER ADDITION 4: Highlight Silver Bullet FVG Setup on the canvas
    if (analysisResult.silverBullet && analysisResult.silverBullet.status !== "INACTIVE") {
      const ePrice = analysisResult.tradeSetup?.entry || (paddedMax + paddedMin) / 2;
      const targetY = getCanvasY(ePrice);
      
      const sbBox = new fabric.Rect({
        left: canvasWidth * 0.25,
        top: Math.max(10, targetY - 22),
        width: canvasWidth * 0.5,
        height: 44,
        fill: "rgba(245, 158, 11, 0.09)", // Warm Gold background
        stroke: "#f59e0b",
        strokeWidth: 1.5,
        strokeDashArray: [4, 4],
        selectable: false,
        evented: false,
      });

      const sbBadge = new fabric.Text(`⚡ SILVER BULLET FVG SETUP (${analysisResult.silverBullet.windowName || 'ACTIVE'})`, {
        left: canvasWidth * 0.25 + 10,
        top: Math.max(12, targetY - 17),
        fontFamily: "Space Grotesk, monospace",
        fontSize: 8.5,
        fontWeight: "bold",
        fill: "#f59e0b",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        padding: 3,
        selectable: false,
        evented: false,
      });

      (sbBox as any).isAiLayer = true;
      (sbBadge as any).isAiLayer = true;
      canvas.add(sbBox, sbBadge);
    }

    // AI SCANNER ADDITION 4.5: Highlight ICT Kill Zone on the canvas
    if (analysisResult.killZone && analysisResult.killZone.status !== "INACTIVE") {
      const ePrice = analysisResult.tradeSetup?.entry || (paddedMax + paddedMin) / 2;
      const targetY = getCanvasY(ePrice);
      
      const kzBox = new fabric.Rect({
        left: canvasWidth * 0.1,
        top: Math.max(10, targetY + 30),
        width: canvasWidth * 0.8,
        height: 38,
        fill: "rgba(6, 182, 212, 0.08)", // Cyan tint
        stroke: "#06b6d4",
        strokeWidth: 1.5,
        strokeDashArray: [5, 3],
        selectable: false,
        evented: false,
      });

      const kzBadge = new fabric.Text(`🎯 ICT KILL ZONE: ${analysisResult.killZone.windowName || 'ACTIVE'}`, {
        left: canvasWidth * 0.1 + 10,
        top: Math.max(12, targetY + 35),
        fontFamily: "Space Grotesk, monospace",
        fontSize: 8,
        fontWeight: "bold",
        fill: "#22d3ee",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        padding: 3,
        selectable: false,
        evented: false,
      });

      (kzBox as any).isAiLayer = true;
      (kzBadge as any).isAiLayer = true;
      canvas.add(kzBox, kzBadge);
    }

    // AI SCANNER ADDITION 4.8: Highlight Judas Swing false breakout indicator with premium callouts
    if (analysisResult.judasSwing && analysisResult.judasSwing.detected) {
      const triggerPrice = Number(analysisResult.judasSwing.triggerLevel) || (paddedMax + paddedMin) / 2;
      const targetY = getCanvasY(triggerPrice);
      const direction = analysisResult.judasSwing.direction || "BEARISH";
      
      // Horizontal threshold boundary line
      const jsLine = new fabric.Line([canvasWidth * 0.15, targetY, canvasWidth * 0.85, targetY], {
        stroke: "rgba(244, 63, 94, 0.75)", // Rose-500 red hunt warning line
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
      });

      // Breakout candle position horizontally at 52% of the canvas width
      const candleX = canvasWidth * 0.52;
      
      const boxWidth = 220;
      const boxHeight = 65;
      const isBearishSweep = direction === "BEARISH"; // Swept High = sits above targetY, pointing down
      
      const boxLeft = candleX - boxWidth / 2;
      const boxTop = isBearishSweep 
        ? Math.max(15, targetY - boxHeight - 35) 
        : Math.min(canvasHeight - boxHeight - 15, targetY + 35);
      
      // Callout background rect card
      const calloutBg = new fabric.Rect({
        left: boxLeft,
        top: boxTop,
        width: boxWidth,
        height: boxHeight,
        rx: 10,
        ry: 10,
        fill: "rgba(15, 23, 42, 0.98)", // Glassy slate background
        stroke: "#ec4899", // Magenta/pink-500 premium color
        strokeWidth: 2,
        selectable: false,
        evented: false,
      });

      // Title text helper
      const titleText = new fabric.Text("🪤 JUDAS SWING FALSE BREAKOUT", {
        left: boxLeft + 10,
        top: boxTop + 8,
        fontFamily: "Space Grotesk, sans-serif",
        fontSize: 8.5,
        fontWeight: "bold",
        fill: "#fdf2f8", // pink-50
        selectable: false,
        evented: false,
      });

      // Description Textbox helper for auto wrap Support
      const descText = new fabric.Textbox(
        analysisResult.judasSwing.description || `Liquidity swept at ${triggerPrice.toFixed(1)} before a sharp rejection and close inside range, indicating a highly-probable institutional reversal model.`,
        {
          left: boxLeft + 10,
          top: boxTop + 22,
          width: boxWidth - 20,
          fontFamily: "Inter, sans-serif",
          fontSize: 7.2,
          lineHeight: 1.25,
          fill: "#fbcfe8", // pink-200
          selectable: false,
          evented: false,
        }
      );

      // Connecting pointer arrow line pointing directly to (candleX, targetY)
      const arrowStartY = isBearishSweep ? boxTop + boxHeight : boxTop;
      const arrowEndY = isBearishSweep ? targetY - 4 : targetY + 4;
      
      const arrowLine = new fabric.Line([candleX, arrowStartY, candleX, arrowEndY], {
        stroke: "#ec4899",
        strokeWidth: 1.5,
        selectable: false,
        evented: false,
      });

      // Pointer Arrow Head Triangle pointing to targetY
      const arrowHead = new fabric.Triangle({
        left: candleX,
        top: arrowEndY,
        originX: "center",
        originY: isBearishSweep ? "top" : "bottom",
        angle: isBearishSweep ? 180 : 0,
        width: 10,
        height: 8,
        fill: "#ec4899",
        selectable: false,
        evented: false,
      });

      // Flag as AI layer so they clear together on recomputation
      (jsLine as any).isAiLayer = true;
      (calloutBg as any).isAiLayer = true;
      (titleText as any).isAiLayer = true;
      (descText as any).isAiLayer = true;
      (arrowLine as any).isAiLayer = true;
      (arrowHead as any).isAiLayer = true;

      canvas.add(jsLine, calloutBg, titleText, descText, arrowLine, arrowHead);
    }

    // AI SCANNER ADDITION 5: Highlight Candle Range Theory (CRT) Range & extremes sweep on the canvas
    if (analysisResult.candleRangeTheory && analysisResult.candleRangeTheory.rangeHigh && analysisResult.candleRangeTheory.rangeLow) {
      const crtHigh = Number(analysisResult.candleRangeTheory.rangeHigh);
      const crtLow = Number(analysisResult.candleRangeTheory.rangeLow);
      
      const yHigh = getCanvasY(crtHigh);
      const yLow = getCanvasY(crtLow);
      const boxHeight = Math.abs(yLow - yHigh) || 60;
      const boxTop = Math.min(yHigh, yLow);
      
      // Draw CRT Range Box
      const crtBox = new fabric.Rect({
        left: canvasWidth * 0.05,
        top: boxTop,
        width: canvasWidth * 0.9,
        height: boxHeight,
        fill: "rgba(139, 92, 246, 0.03)", // Light premium purple tint
        stroke: "rgba(139, 92, 246, 0.45)",
        strokeWidth: 1.5,
        strokeDashArray: [6, 4],
        selectable: false,
        evented: false,
      });

      // Label
      const crtBadgeText = `🕯️ CRT RANGE [${crtLow.toFixed(1)} - ${crtHigh.toFixed(1)}] ${analysisResult.candleRangeTheory.sweepType !== 'NONE' ? '• 🧹 SWEEP DETECTED' : ''}`;
      const crtBadge = new fabric.Text(crtBadgeText, {
        left: canvasWidth * 0.05 + 12,
        top: boxTop + 6,
        fontFamily: "Space Grotesk, monospace",
        fontSize: 8,
        fontWeight: "bold",
        fill: "#c084fc",
        backgroundColor: "rgba(15, 23, 42, 0.95)",
        padding: 4,
        selectable: false,
        evented: false,
      });

      // Add to canvas
      (crtBox as any).isAiLayer = true;
      (crtBadge as any).isAiLayer = true;
      canvas.add(crtBox, crtBadge);

      // If extreme high/low swept, draw sweep indicator arrow or circle
      if (analysisResult.candleRangeTheory.sweepType === "HIGH_SWEPT") {
        const sweepLine = new fabric.Line([canvasWidth * 0.5, yHigh, canvasWidth * 0.5, yHigh - 22], {
          stroke: "#f43f5e",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        const sweepArrowLeft = new fabric.Line([canvasWidth * 0.5 - 6, yHigh - 14, canvasWidth * 0.5, yHigh - 22], {
          stroke: "#f43f5e",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        const sweepArrowRight = new fabric.Line([canvasWidth * 0.5 + 6, yHigh - 14, canvasWidth * 0.5, yHigh - 22], {
          stroke: "#f43f5e",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });

        const sweepLabel = new fabric.Text("🧹 CRT sweep high extreme", {
          left: canvasWidth * 0.5 + 10,
          top: yHigh - 20,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 8,
          fontWeight: "bold",
          fill: "#f43f5e",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          padding: 2,
          selectable: false,
          evented: false,
        });

        (sweepLine as any).isAiLayer = true;
        (sweepArrowLeft as any).isAiLayer = true;
        (sweepArrowRight as any).isAiLayer = true;
        (sweepLabel as any).isAiLayer = true;
        canvas.add(sweepLine, sweepArrowLeft, sweepArrowRight, sweepLabel);
      } else if (analysisResult.candleRangeTheory.sweepType === "LOW_SWEPT") {
        const sweepLine = new fabric.Line([canvasWidth * 0.5, yLow, canvasWidth * 0.5, yLow + 22], {
          stroke: "#10b981",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        const sweepArrowLeft = new fabric.Line([canvasWidth * 0.5 - 6, yLow + 14, canvasWidth * 0.5, yLow + 22], {
          stroke: "#10b981",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });
        const sweepArrowRight = new fabric.Line([canvasWidth * 0.5 + 6, yLow + 14, canvasWidth * 0.5, yLow + 22], {
          stroke: "#10b981",
          strokeWidth: 2,
          selectable: false,
          evented: false,
        });

        const sweepLabel = new fabric.Text("🧹 CRT sweep low extreme", {
          left: canvasWidth * 0.5 + 10,
          top: yLow + 8,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 8,
          fontWeight: "bold",
          fill: "#10b981",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          padding: 2,
          selectable: false,
          evented: false,
        });

        (sweepLine as any).isAiLayer = true;
        (sweepArrowLeft as any).isAiLayer = true;
        (sweepArrowRight as any).isAiLayer = true;
        (sweepLabel as any).isAiLayer = true;
        canvas.add(sweepLine, sweepArrowLeft, sweepArrowRight, sweepLabel);
      }
    }

    // AI SCANNER ADDITION 6: Power of 3 (AMD) Accumulation, Manipulation, Distribution
    if (analysisResult.powerOf3 && analysisResult.powerOf3.detected) {
      const p3 = analysisResult.powerOf3;
      
      // 1. Accumulation Range Box
      if (p3.accumulationRange) {
        const range = parsePricesFromText(p3.accumulationRange);
        if (range.length >= 2) {
          const accLow = Math.min(range[0], range[1]);
          const accHigh = Math.max(range[0], range[1]);
          const yHigh = getCanvasY(accHigh);
          const yLow = getCanvasY(accLow);
          const boxHeight = Math.abs(yLow - yHigh) || 40;
          const boxTop = Math.min(yHigh, yLow);

          const accBox = new fabric.Rect({
            left: canvasWidth * 0.08,
            top: boxTop,
            width: canvasWidth * 0.35, // Render on the left section of the workspace bounds
            height: boxHeight,
            fill: "rgba(14, 116, 144, 0.08)", // cyan-800 soft tint
            stroke: "rgba(14, 116, 144, 0.45)",
            strokeWidth: 1.5,
            selectable: false,
            evented: false,
          });

          const accLabel = new fabric.Text("📦 AMD: ACCUMULATION (RANGE)", {
            left: canvasWidth * 0.08 + 6,
            top: boxTop + 4,
            fontFamily: "Space Grotesk, monospace",
            fontSize: 7.5,
            fontWeight: "bold",
            fill: "#22d3ee",
            backgroundColor: "rgba(15, 23, 42, 0.95)",
            padding: 2.5,
            selectable: false,
            evented: false,
          });

          (accBox as any).isAiLayer = true;
          (accLabel as any).isAiLayer = true;
          canvas.add(accBox, accLabel);
        }
      }

      // 2. Manipulation Level Block
      if (p3.manipulationLevel) {
        const manipPrice = Number(p3.manipulationLevel);
        const yManip = getCanvasY(manipPrice);

        const manipMarker = new fabric.Line([canvasWidth * 0.43, yManip, canvasWidth * 0.58, yManip], {
          stroke: "#f43f5e", // Rose-500 red hunt warning
          strokeWidth: 2,
          strokeDashArray: [3, 2],
          selectable: false,
          evented: false,
        });

        const manipLabel = new fabric.Text(`🚨 AMD: MANIPULATION (SWEEP/TRAP) at ${manipPrice.toFixed(1)}`, {
          left: canvasWidth * 0.43 + 6,
          top: yManip - 10,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 7.5,
          fontWeight: "bold",
          fill: "#fda4af",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          padding: 2.5,
          selectable: false,
          evented: false,
        });

        (manipMarker as any).isAiLayer = true;
        (manipLabel as any).isAiLayer = true;
        canvas.add(manipMarker, manipLabel);
      }

      // 3. Distribution Channel Range
      if (p3.distributionTarget) {
        const distPrice = Number(p3.distributionTarget);
        const yDist = getCanvasY(distPrice);
        const refY = p3.manipulationLevel ? getCanvasY(Number(p3.manipulationLevel)) : yDist + 60;

        const distBox = new fabric.Rect({
          left: canvasWidth * 0.6,
          top: Math.min(yDist, refY),
          width: canvasWidth * 0.32, // Right partition
          height: Math.abs(yDist - refY) || 80,
          fill: "rgba(16, 185, 129, 0.05)", // Soft green tint
          stroke: "rgba(16, 185, 129, 0.3)",
          strokeWidth: 1.5,
          strokeDashArray: [4, 4],
          selectable: false,
          evented: false,
        });

        const distLabel = new fabric.Text(`🚀 AMD: DISTRIBUTION (RUN) target ${distPrice.toFixed(1)}`, {
          left: canvasWidth * 0.6 + 6,
          top: Math.min(yDist, refY) + 6,
          fontFamily: "Space Grotesk, monospace",
          fontSize: 7.5,
          fontWeight: "bold",
          fill: "#34d399",
          backgroundColor: "rgba(15, 23, 42, 0.95)",
          padding: 2.5,
          selectable: false,
          evented: false,
        });

        (distBox as any).isAiLayer = true;
        (distLabel as any).isAiLayer = true;
        canvas.add(distBox, distLabel);
      }
    }

    canvas.renderAll();
    setTimeout(() => {
      if (canvas) {
        setRedoStack([]); // Initialize stack
        // Auto update parent save composite hook
        try {
          const dataUrl = canvas.toDataURL({
            multiplier: 1,
            format: "png",
            quality: 0.92,
          });
          onSaveComposite(dataUrl);
        } catch (e) {
          console.warn("Canvas toDataURL failed or was tainted, falling back to original image:", e);
          onSaveComposite(imageUrl || "");
        }
      }
    }, 200);
  };

  // Helper utility: parse all decimals/numbers from text description fields
  const parsePricesFromText = (text: string): number[] => {
    if (!text) return [];
    const matches = text.match(/\d+[\.\d]*/g);
    if (!matches) return [];
    return matches.map((m) => parseFloat(m)).filter((p) => !isNaN(p) && p > 0);
  };

  // Quick Action: Add interactive Entry Level
  const handleAddQuickEntry = () => {
    addInteractiveHorizontalLine("ENTRY", "#22d3ee", entryPrice);
  };

  // Quick Action: Add Stop Loss Level
  const handleAddQuickStopLoss = () => {
    addInteractiveHorizontalLine("SL", "#f43f5e", stopLossPrice);
  };

  // Quick Action: Add Take Profit 1 & 2
  const handleAddQuickTP1 = () => {
    addInteractiveHorizontalLine("TP1", "#10b981", tp1Price);
  };

  const handleAddQuickTP2 = () => {
    addInteractiveHorizontalLine("TP2", "#34d399", tp2Price);
  };

  // Create customized precise interactive TradingView level trackers with vertical restriction
  const addInteractiveHorizontalLine = (name: string, activeColor: string, targetPrice: number) => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Check and prune duplicates
    const oldObjects = canvas.getObjects().filter(
      (o: any) => o.name === name || o.id === `${name}_LABEL` || o.id === `${name}_LINE`
    );
    oldObjects.forEach((o) => canvas.remove(o));

    const y = getCanvasY(targetPrice);

    // 1. Create horizontal dashboard tracker line
    const line = new fabric.Line([0, y, canvasWidth - 10, y], {
      id: `${name}_LINE`,
      name: name,
      stroke: activeColor,
      strokeWidth: 2.5,
      strokeDashArray: [6, 4],
      selectable: true,
      hasControls: false, // drag only
      lockMovementX: true, // vertical constraints
      hoverCursor: "ns-resize",
    } as any);

    // 2. Create high contrast descriptive badge label
    const label = new fabric.Text(` [ ${name} LEVEL ] `, {
      id: `${name}_LABEL`,
      left: 20,
      top: y - 18,
      fontFamily: "Space Grotesk, monospace",
      fontSize: 10,
      fontWeight: "bold",
      fill: activeColor,
      backgroundColor: "rgba(15, 23, 42, 0.9)",
      padding: 3,
      selectable: false,
      evented: false,
    } as any);

    canvas.add(line, label);
    canvas.setActiveObject(line);
    canvas.renderAll();
    updatePreviews();
  };

  // Update composite image changes up to parent state to hold buffer
  const updatePreviews = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    try {
      const compositeUrl = canvas.toDataURL({
        multiplier: 1,
        format: "jpeg",
        quality: 0.95,
      });
      onSaveComposite(compositeUrl);
    } catch (e) {
      console.warn("Canvas toDataURL failed or was tainted, falling back to original image:", e);
      onSaveComposite(imageUrl || "");
    }
  };

  // Undo last drawings
  const handleUndo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    if (objects.length === 0) return;

    // Filter out underlying AI layers so we do not delete AI outlines accidentally
    const userObjects = objects.filter((o: any) => !o.isAiLayer);
    if (userObjects.length === 0) return;

    const topPickedObj = userObjects[userObjects.length - 1];
    setRedoStack((prev) => [...prev, topPickedObj]);
    canvas.remove(topPickedObj);
    canvas.renderAll();
    updatePreviews();
  };

  // Redo last undone drawings
  const handleRedo = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    if (redoStack.length === 0) return;
    const nextObj = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.slice(0, prev.length - 1));
    canvas.add(nextObj);
    canvas.renderAll();
    updatePreviews();
  };

  // Clear AI layers from workspace
  const handleClearAiLayers = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    const objects = canvas.getObjects();
    objects.forEach((obj: any) => {
      if (obj.isAiLayer) {
        canvas.remove(obj);
      }
    });
    canvas.renderAll();
    updatePreviews();
  };

  // Clear entire board completely
  const handleClearAll = () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    // Remove all objects
    const objects = [...canvas.getObjects()];
    objects.forEach((obj) => canvas.remove(obj));
    canvas.renderAll();
    updatePreviews();
  };

  // Save full trade plan data manually into the Firestore trade entries ledger
  const handleSaveCompleteTradePlan = async () => {
    const canvas = fabricCanvasRef.current;
    if (!canvas) return;

    setIsSaving(true);
    setSaveStatus("saving");
    setErrorMessage(null);

    // Export high-resolution annotated image composite
    let compositeUrl = imageUrl || "";
    try {
      compositeUrl = canvas.toDataURL({
        multiplier: 1,
        format: "jpeg",
        quality: 0.95,
      });
    } catch (e) {
      console.warn("Canvas toDataURL failed or was tainted, falling back to original image:", e);
    }

    try {
      const payload = {
        symbol: analysisResult?.ticker || analysisResult?.symbol || "SMC SYNTH",
        timeframe: analysisResult?.timeframe || "H1",
        bias: analysisResult?.bias || "NEUTRAL",
        entry_price: Number(entryPrice),
        stop_loss: Number(stopLossPrice),
        take_profit: Number(tp1Price),
        risk_reward: analysisResult?.tradeSetup?.riskRewardRatio || "1:2.5",
        image_url: compositeUrl,
        notes: tradeNotes.trim() || `SMC mechanical targets saved manually from interactive dashboard. Notes: TP1 at ${tp1Price}, TP2 at ${tp2Price}. Stop-loss: ${stopLossPrice}`,
        status: "PENDING" as const,
        analysis_info: {
          marketStructure: analysisResult?.marketStructure || "Interactive Structure Plan",
          orderBlock: {
            priceRange: analysisResult?.orderBlock?.priceRange || `${entryPrice} - ${tp1Price}`,
            type: analysisResult?.orderBlock?.type || "Interactive Block",
            rationale: analysisResult?.orderBlock?.rationale || "Configured by user targets"
          },
          supplyDemandZones: {
            supply: analysisResult?.supplyDemandZones?.supply || "",
            demand: analysisResult?.supplyDemandZones?.demand || "",
            activeZone: analysisResult?.supplyDemandZones?.activeZone || "Equilibrium"
          },
          fibonacciRetracement: {
            level_50: Number(analysisResult?.fibonacciRetracement?.level_50) || 0.5,
            level_618: Number(analysisResult?.fibonacciRetracement?.level_618) || 0.618,
            level_786: Number(analysisResult?.fibonacciRetracement?.level_786) || 0.786,
            description: analysisResult?.fibonacciRetracement?.description || "Drawn on active workspace"
          },
          tradeSetup: {
            type: analysisResult?.tradeSetup?.type || "WAIT",
            entry: Number(entryPrice),
            stopLoss: Number(stopLossPrice),
            takeProfits: [Number(tp1Price), Number(tp2Price)],
            riskRewardRatio: analysisResult?.tradeSetup?.riskRewardRatio || "1:3",
            rationale: analysisResult?.tradeSetup?.rationale || "Manual override trade configuration"
          }
        }
      };

      // Call database writer
      await saveTrade(payload);
      setSaveStatus("success");
      
      // Auto success timeout reset
      setTimeout(() => {
        setSaveStatus("idle");
      }, 5000);

    } catch (err: any) {
      console.error("Save complete plan failed:", err);
      setSaveStatus("error");
      setErrorMessage(err?.message || "Internal database connection timeout or authentication missing.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6" id="supreme-interactive-charting-suite">
      
      {/* 1. CYBERPUNK TOOLBAR CONTROLS HEADER */}
      <div className="bg-gradient-to-b from-[#0f172a] to-[#090d16] border border-slate-200 p-4 rounded-2xl space-y-4 shadow-xl">
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-center justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-cyan-400 animate-ping"></span>
              <h4 className="text-xs font-black uppercase tracking-widest text-[#22d3ee] font-mono flex items-center gap-1.5">
                <Sliders className="h-4 w-4" /> Vector Stylus & SMC Drawing Deck
              </h4>
            </div>
            <p className="text-[11px] text-slate-600">
              Drag interactive lines, draw demand zones, or overlay Fibonacci retracement levels onto the chart background.
            </p>
          </div>

          {/* Quick Buttons overlay triggers */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={handleAddQuickEntry}
              className="p-1.5 px-3 rounded-xl bg-cyan-950/40 border border-cyan-800/60 hover:bg-cyan-900/40 text-[#22d3ee] font-bold text-[10px] uppercase font-mono tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              title="Draw precise entry line"
            >
              <Plus className="h-3 w-3 text-cyan-400" />
              + Add My Entry
            </button>
            <button
              onClick={handleAddQuickStopLoss}
              className="p-1.5 px-3 rounded-xl bg-rose-950/40 border border-rose-800/60 hover:bg-rose-900/40 text-rose-400 font-bold text-[10px] uppercase font-mono tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              title="Draw stop loss line"
            >
              <Plus className="h-3 w-3 text-rose-400" />
              + Add Stop Loss
            </button>
            <button
              onClick={handleAddQuickTP1}
              className="p-1.5 px-3 rounded-xl bg-emerald-950/40 border border-emerald-800/60 hover:bg-emerald-900/40 text-emerald-400 font-bold text-[10px] uppercase font-mono tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              title="Draw take profit target 1"
            >
              <Plus className="h-3 w-3 text-emerald-400" />
              + Add TP1
            </button>
            <button
              onClick={handleAddQuickTP2}
              className="p-1.5 px-3 rounded-xl bg-teal-950/40 border border-teal-800/60 hover:bg-teal-900/40 text-teal-300 font-bold text-[10px] uppercase font-mono tracking-wider transition-all flex items-center gap-1 cursor-pointer"
              title="Draw take profit target 2"
            >
              <Plus className="h-3 w-3 text-teal-400" />
              + Add TP2
            </button>
          </div>
        </div>

        {/* BRUSH & TOOL SELECTION */}
        <div className="flex flex-wrap items-center gap-4 pt-3 border-t border-slate-200">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              onClick={() => setActiveTool("free")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "free"
                  ? "bg-cyan-500 text-slate-950 px-3.5 font-extrabold shadow-md shadow-cyan-500/20"
                  : "bg-slate-50 border border-slate-850 text-slate-700 hover:text-slate-900"
              }`}
              title="Pencil Free Draw"
            >
              <Paintbrush className="h-3.5 w-3.5 shrink-0" />
              <span>Freehand</span>
            </button>

            <button
              onClick={() => setActiveTool("rect")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "rect"
                  ? "bg-indigo-600 text-slate-900 px-3.5 font-extrabold shadow-md shadow-indigo-600/25"
                  : "bg-slate-50 border border-slate-850 text-slate-700 hover:text-slate-900"
              }`}
              title="Draw Order Block Rectangles"
            >
              <Square className="h-3.5 w-3.5 shrink-0" />
              <span>Rect OB</span>
            </button>

            <button
              onClick={() => setActiveTool("line")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "line"
                  ? "bg-sky-600 text-slate-900 px-3.5 font-extrabold shadow-md shadow-sky-600/25"
                  : "bg-slate-50 border border-slate-850 text-slate-700 hover:text-slate-900"
              }`}
              title="Draw infinite horizontal level lines"
            >
              <Scale className="h-3.5 w-3.5 shrink-0" />
              <span>Horizontal Line</span>
            </button>

            <button
              onClick={() => setActiveTool("trendline")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "trendline"
                  ? "bg-purple-500 text-slate-950 px-3.5 font-extrabold shadow-md shadow-purple-500/25"
                  : "bg-slate-50 border border-slate-850 text-slate-700 hover:text-slate-900"
              }`}
              title="Draw custom trendlines"
            >
              <TrendingUp className="h-3.5 w-3.5 shrink-0" />
              <span>Trendline</span>
            </button>

            <button
              onClick={() => setActiveTool("arrow")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "arrow"
                  ? "bg-amber-500 text-slate-950 px-3.5 font-extrabold shadow-md shadow-amber-500/25"
                  : "bg-slate-50 border border-slate-850 text-slate-700 hover:text-slate-900"
              }`}
              title="Draw bias arrow structures"
            >
              <ArrowRight className="h-3.5 w-3.5 shrink-0" />
              <span>Arrow</span>
            </button>

            <button
              onClick={() => setActiveTool("text")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "text"
                  ? "bg-fuchsia-600 text-slate-900 px-3.5 font-extrabold shadow-md shadow-fuchsia-600/25"
                  : "bg-slate-50 border border-slate-850 text-slate-600 hover:text-slate-900"
              }`}
              title="Write labels on canvas"
            >
              <Type className="h-3.5 w-3.5 shrink-0" />
              <span>Custom Text</span>
            </button>

            <button
              onClick={() => setActiveTool("eraser")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1.5 cursor-pointer ${
                activeTool === "eraser"
                  ? "bg-rose-600 text-slate-900 px-3.5 font-extrabold shadow-md shadow-rose-600/25"
                  : "bg-slate-50 border border-slate-850 text-slate-600 hover:text-slate-900"
              }`}
              title="Eraser (Click any drawn element to delete)"
            >
              <Eraser className="h-3.5 w-3.5 shrink-0" />
              <span>Eraser</span>
            </button>

            <button
              onClick={() => setActiveTool("none")}
              className={`p-2.5 rounded-xl text-xs font-bold transition duration-150 flex items-center gap-1 cursor-pointer ${
                activeTool === "none"
                  ? "bg-slate-200 text-slate-900 px-3.5"
                  : "bg-slate-50 border border-slate-850 text-slate-450 hover:text-slate-900"
              }`}
              title="Select, resize, or drag elements"
            >
              Select / Move
            </button>
          </div>

          <div className="h-6 w-px bg-slate-850/70 hidden md:block"></div>

          {/* Color & opacity controllers */}
          <div className="flex items-center gap-4 flex-wrap">
            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Palette:</span>
              <div className="flex gap-1.5 items-center">
                {["#22d3ee", "#8b5cf6", "#10b981", "#f59e0b", "#f43f5e"].map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setColor(c)}
                    className={`h-5 w-5 rounded-full border transition-transform cursor-pointer ${
                      color === c ? "scale-125 border-white ring-2 ring-indigo-500/50" : "border-slate-200 hover:scale-105"
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Opacity:</span>
              <input
                type="range"
                min="0.1"
                max="1.0"
                step="0.1"
                value={opacity}
                onChange={(e) => setOpacity(parseFloat(e.target.value))}
                className="w-16 accent-indigo-500 h-1 bg-slate-200"
              />
              <span className="text-[10px] text-slate-600 font-mono">{(opacity * 100).toFixed(0)}%</span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 uppercase font-mono font-bold">Size:</span>
              <input
                type="range"
                min="1"
                max="12"
                step="1"
                value={brushSize}
                onChange={(e) => setBrushSize(parseInt(e.target.value))}
                className="w-16 accent-indigo-500 h-1 bg-slate-200"
              />
              <span className="text-[10px] text-slate-600 font-mono">{brushSize}px</span>
            </div>
          </div>

          {/* Utility modifiers */}
          <div className="flex items-center gap-1.5 border-l border-slate-950 pl-3 ml-auto text-xs">
            <button
              onClick={handleUndo}
              className="p-2 rounded-xl bg-slate-50 border border-slate-850 hover:bg-slate-100 text-slate-350 cursor-pointer flex items-center gap-1 transition text-xs font-semibold"
              title="Undo last change"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span className="hidden xl:inline font-mono">Undo</span>
            </button>

            <button
              onClick={handleRedo}
              disabled={redoStack.length === 0}
              className={`p-2 rounded-xl border flex items-center gap-1 transition text-xs font-semibold cursor-pointer ${
                redoStack.length === 0
                  ? "bg-slate-50/40 border-slate-200 text-slate-600 cursor-not-allowed"
                  : "bg-slate-50 border-slate-850 hover:bg-slate-100 text-slate-350"
              }`}
              title="Redo last change"
            >
              <RotateCw className="h-3.5 w-3.5" />
              <span className="hidden xl:inline font-mono">Redo</span>
            </button>

            <button
              onClick={handleClearAiLayers}
              className="p-1 px-2.5 rounded-xl bg-amber-950/20 border border-amber-900/40 hover:bg-amber-900/20 text-amber-400 cursor-pointer text-[10px] uppercase font-mono tracking-wider transition"
              title="Remove background AI layers"
            >
              Hide AI Lines
            </button>

            <button
              onClick={handleClearAll}
              className="p-2 rounded-xl bg-slate-50 border border-slate-850 hover:bg-red-950/25 text-slate-600 hover:text-red-400 cursor-pointer flex items-center gap-1 transition text-xs font-semibold"
              title="Wipe whole workspace"
            >
              <Trash2 className="h-3.5 w-3.5" />
              <span className="hidden xl:inline font-mono">Clear All</span>
            </button>
          </div>
        </div>
      </div>

      {/* 2. MAIN WORKSPACE DESIGN PANEL */}
      <div className="grid grid-cols-1 xl:grid-cols-4 gap-6">
        
        {/* VIEWPORT & PRICE AXIS WRAPPER (Col: 3/4) */}
        <div className="xl:col-span-3 space-y-3">
          <div 
            ref={containerRef}
            className="flex bg-slate-50 border border-slate-850 rounded-2xl overflow-hidden shadow-2xl relative select-none"
            style={{ minHeight: "490px" }}
          >
            {/* Overlay loading mask */}
            {!imageLoaded && (
              <div className="absolute inset-0 bg-slate-50/90 z-20 flex flex-col items-center justify-center p-8 text-center space-y-3">
                <div className="h-8 w-8 border-3 border-cyan-400 border-t-transparent rounded-full animate-spin"></div>
                <div className="space-y-1">
                  <p className="text-xs text-slate-800 font-bold uppercase tracking-widest font-mono">
                    Compiling Fabric Layer matrices...
                  </p>
                  <p className="text-[10px] text-slate-500 font-mono">ASSEMBLING HIGH-PRECISION TICK TRACKER</p>
                </div>
              </div>
            )}

            {/* FLOATING R:R HUD OVERLAY ON CANVAS (Updates in real-time) */}
            {entryPrice && stopLossPrice && (tp1Price || tp2Price) && (
              <div id="floating-rr-hud-canvas" className="absolute top-4 left-4 z-10 bg-slate-50/85 backdrop-blur-md border border-cyan-500/35 p-3 rounded-xl shadow-lg shadow-black/80 font-mono text-[10.5px] space-y-1 text-slate-700 min-w-[140px] pointer-events-none transition-all select-none">
                <div className="flex items-center gap-1.5 border-b border-slate-200 pb-1 mb-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                  <span className="font-bold text-[#22d3ee] uppercase tracking-wider text-[9px]">SMC Live Ratio</span>
                </div>
                {tp1Price ? (
                  <div className="flex justify-between items-center gap-4">
                    <span>TP1 Ratio:</span>
                    <span className="font-black text-emerald-400 text-xs">
                      1:{(Math.abs(tp1Price - entryPrice) / (Math.abs(entryPrice - stopLossPrice) || 1)).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                {tp2Price ? (
                  <div className="flex justify-between items-center gap-4">
                    <span>TP2 Ratio:</span>
                    <span className="font-black text-teal-400 text-xs">
                      1:{(Math.abs(tp2Price - entryPrice) / (Math.abs(entryPrice - stopLossPrice) || 1)).toFixed(2)}
                    </span>
                  </div>
                ) : null}
                <div className="pt-1 mt-1 border-t border-slate-200 flex justify-between text-[9px] text-slate-500">
                  <span>Risk Offset:</span>
                  <span className="text-rose-400 font-bold">{Math.abs(entryPrice - stopLossPrice).toFixed(1)} pts</span>
                </div>
              </div>
            )}

            {/* DRAWING WORKSPACE (VIRTUAL INSIDE CONTAINER) */}
            <div className="flex-grow overflow-x-auto scrollbar-thin outline-none relative">
              <canvas
                ref={canvasRef}
                className="select-none block touch-none outline-none mx-auto bg-white"
              />
            </div>

            {/* TRADINGVIEW CYBER Y-AXIS SIDEBAR */}
            <div 
              className="w-24 bg-[#0a0d14] border-l border-slate-850 flex flex-col justify-start relative text-[9px] font-mono select-none" 
              style={{ height: `${canvasHeight}px` }}
            >
              <div className="absolute inset-x-0 top-1 text-center text-[#22d3ee] font-sans font-bold border-b border-slate-200 pb-1 text-[8px] uppercase tracking-wider">
                Index Scale
              </div>

              {/* Distribute price markings */}
              {Array.from({ length: 7 }).map((_, idx) => {
                const ratio = idx / 6; // 0 to 1 split
                const price = paddedMax - ratio * (paddedMax - paddedMin);
                const topPct = ratio * 100;
                return (
                  <div 
                    key={idx} 
                    className="absolute left-0 right-0 border-t border-slate-200/40 text-slate-500 pl-2 pointer-events-none text-left" 
                    style={{ top: `${topPct}%` }}
                  >
                    <span className="relative -top-2 bg-[#0a0d14]/85 px-1 rounded text-[8.5px] leading-none text-slate-600 font-mono font-medium">
                      {price.toFixed(1)}
                    </span>
                  </div>
                );
              })}

              {/* Dynamic Highlight overlay points matching live entries */}
              {[
                { label: "ENTRY", price: entryPrice, color: "bg-cyan-950 border-cyan-400 text-cyan-400" },
                { label: "SL", price: stopLossPrice, color: "bg-rose-950 border-rose-400 text-rose-400" },
                { label: "TP1", price: tp1Price, color: "bg-emerald-950 border-emerald-400 text-emerald-400" },
                { label: "TP2", price: tp2Price, color: "bg-teal-950 border-teal-400 text-teal-400" }
              ].map((tick, i) => {
                const topPct = ((paddedMax - tick.price) / (paddedMax - paddedMin)) * 100;
                if (topPct >= 0 && topPct <= 100) {
                  return (
                    <div 
                      key={`scale-tick-${i}`} 
                      className="absolute left-0 right-0 flex items-center h-4 transition-all"
                      style={{ top: `calc(${topPct}% - 8px)` }}
                    >
                      <div className="w-1.5 h-1.5 bg-[#0a0d14] border-t border-l border-slate-300 rotate-45 -mr-1 z-10"></div>
                      <div className={`px-1 rounded font-mono font-bold border text-[7.5px] leading-relaxed shrink-0 w-full text-center ${tick.color}`}>
                        {tick.label}: {tick.price.toFixed(0)}
                      </div>
                    </div>
                  );
                }
                return null;
              })}
            </div>
          </div>

          <div className="bg-slate-50/80 border border-slate-200 px-4 py-2.5 rounded-xl flex items-center justify-between text-[11px] text-slate-600">
            <span className="flex items-center gap-1.5 text-[10px] font-mono tracking-wider">
              <Grid className="h-3.5 w-3.5 text-indigo-400" /> RESIZE VIEWPORT REFERENCE TO: {canvasWidth}x{canvasHeight}px
            </span>
            <span className="font-mono text-[10px] text-slate-500">
              Drag labels or adjust manually on the sidebar control center.
            </span>
          </div>
        </div>

        {/* 3. PARAMS & COMMIT CARD CENTER (Col: 1/4) */}
        <div className="xl:col-span-1 space-y-4">
          <div className="bg-gradient-to-b from-[#0f172a] to-[#090d16] border border-slate-200 p-5 rounded-2xl space-y-4 shadow-xl">
            <div className="border-b border-slate-200 pb-3">
              <h4 className="text-xs font-black uppercase text-[#22d3ee] tracking-widest font-mono flex items-center gap-1.5">
                <Activity className="h-4 w-4" /> Position Tuner
              </h4>
              <p className="text-[10px] text-slate-600 mt-1">Manual overrides sync instantly to the canvas.</p>
            </div>

            {/* Inputs list */}
            <div className="space-y-3 font-sans">
              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest font-extrabold text-cyan-400 mb-1">
                  Trigger Entry Price
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={entryPrice}
                    onChange={(e) => setEntryPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 pl-8 bg-slate-50 border border-slate-850 rounded-lg text-slate-900 font-mono font-bold focus:outline-none focus:border-cyan-500"
                  />
                  <div className="absolute left-2.5 top-3 w-1.5 h-1.5 rounded-full bg-cyan-400"></div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest font-extrabold text-rose-400 mb-1">
                  Risk Stop Loss (SL)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={stopLossPrice}
                    onChange={(e) => setStopLossPrice(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 pl-8 bg-slate-50 border border-slate-850 rounded-lg text-rose-200 font-mono font-bold focus:outline-none focus:border-rose-500"
                  />
                  <div className="absolute left-2.5 top-3 w-1.5 h-1.5 rounded-full bg-rose-400"></div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest font-extrabold text-emerald-400 mb-1">
                  Take Profit 1 (TP1)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={tp1Price}
                    onChange={(e) => setTp1Price(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 pl-8 bg-slate-50 border border-slate-850 rounded-lg text-emerald-200 font-mono font-bold focus:outline-none focus:border-emerald-500"
                  />
                  <div className="absolute left-2.5 top-3 w-1.5 h-1.5 rounded-full bg-emerald-400"></div>
                </div>
              </div>

              <div>
                <label className="block text-[10px] uppercase font-mono tracking-widest font-extrabold text-teal-300 mb-1">
                  Take Profit 2 (TP2)
                </label>
                <div className="relative">
                  <input
                    type="number"
                    value={tp2Price}
                    onChange={(e) => setTp2Price(parseFloat(e.target.value) || 0)}
                    className="w-full text-xs p-2.5 pl-8 bg-slate-50 border border-slate-850 rounded-lg text-teal-100 font-mono font-bold focus:outline-none focus:border-teal-500"
                  />
                  <div className="absolute left-2.5 top-3 w-1.5 h-1.5 rounded-full bg-teal-300"></div>
                </div>
              </div>
            </div>

            {/* Risk reward calculator display */}
            {entryPrice && stopLossPrice && tp1Price && (
              <div className="bg-slate-50/70 border border-slate-850/60 p-3 rounded-xl space-y-1.5">
                <span className="text-[9px] uppercase tracking-wider text-slate-500 font-mono font-bold">
                  SMC Ratio Matrix
                </span>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-600">Risked Points:</span>
                  <span className="text-xs font-mono font-bold text-rose-400">
                    {Math.abs(entryPrice - stopLossPrice).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between pb-1.5 border-b border-slate-200/60">
                  <span className="text-[10px] text-slate-600">Target Points:</span>
                  <span className="text-xs font-mono font-bold text-emerald-400">
                    {Math.abs(tp1Price - entryPrice).toFixed(1)}
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[10px] text-indigo-400 font-bold">Risk Reward:</span>
                  <span className="text-xs font-mono font-black text-[#22d3ee]">
                    1:{(Math.abs(tp1Price - entryPrice) / (Math.abs(entryPrice - stopLossPrice) || 1)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            {/* Journal Commentary text notes */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-[10px] uppercase font-mono tracking-widest font-extrabold text-slate-600">
                Journal Commentary
              </label>
              <textarea
                placeholder="Type structural notes, mitigation reasons, liquidity targets..."
                value={tradeNotes}
                onChange={(e) => setTradeNotes(e.target.value)}
                className="w-full min-h-[90px] p-2.5 bg-slate-50 border border-slate-850 rounded-xl text-xs text-slate-800 focus:outline-none focus:border-indigo-400 leading-relaxed font-sans"
              />
            </div>

            {/* Error notifications */}
            {errorMessage && (
              <div className="p-3 bg-rose-950/20 border border-rose-900/30 text-rose-400 rounded-lg text-xs leading-relaxed font-sans">
                {errorMessage}
              </div>
            )}

            {/* Save success badge */}
            {saveStatus === "success" && (
              <div className="p-3 bg-emerald-950/20 border border-emerald-900/30 text-emerald-400 rounded-lg text-xs font-bold font-sans flex items-center gap-2">
                <Check className="h-4 w-4 text-emerald-400" />
                <span>Plan saved to ledger! view in Journal lists.</span>
              </div>
            )}

            {/* SUBMIT BUTTON */}
            <button
              onClick={handleSaveCompleteTradePlan}
              disabled={isSaving}
              className="w-full p-3 bg-[#4f46e5] hover:bg-[#4338ca] border border-indigo-500 font-black tracking-wider rounded-xl text-[11px] uppercase font-mono text-slate-900 transition-all flex items-center justify-center gap-2 shadow-lg shadow-indigo-200/50 disabled:opacity-50 cursor-pointer"
            >
              {isSaving ? (
                <>
                  <div className="h-3 w-3 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  <span>Saving to cloud...</span>
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 text-cyan-400" />
                  <span>Save Complete Trade Plan</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
