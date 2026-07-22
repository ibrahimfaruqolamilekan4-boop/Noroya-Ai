import { jsPDF } from "jspdf";
import { Trade } from "./db";

/**
 * Generates and downloads a highly styled, professional PDF report of a trade setup
 * and its smart money concepts (SMC) analysis findings.
 */
export async function exportTradeToPDF(trade: Trade) {
  // Initialize standard A4 PDF document
  // A4 dimensions: 210mm x 297mm
  const doc = new jsPDF({
    orientation: "portrait",
    unit: "mm",
    format: "a4",
  });

  const pageWidth = 210;
  const pageHeight = 297;
  const marginX = 15;
  const printableWidth = pageWidth - (marginX * 2); // 180mm
  
  let yOffset = 18; // Tracks vertical printing cursor in mm

  // Helper: Draw borders and primary guidelines
  const drawPageBorder = () => {
    // Elegant outside thin border
    doc.setDrawColor(30, 41, 59); // Slate-800
    doc.setLineWidth(0.3);
    doc.rect(marginX - 5, 10, printableWidth + 10, pageHeight - 20);

    // Minor decorative corners
    doc.setDrawColor(245, 158, 11); // Amber accent
    doc.setLineWidth(1);
    
    // Top-Left corner accent
    doc.line(marginX - 5, 10, marginX + 15, 10);
    doc.line(marginX - 5, 10, marginX - 5, 30);
    
    // Bottom-Right corner accent
    doc.line(pageWidth - marginX + 5, pageHeight - 10, pageWidth - marginX - 15, pageHeight - 10);
    doc.line(pageWidth - marginX + 5, pageHeight - 10, pageWidth - marginX + 5, pageHeight - 30);
  };

  // Helper: Setup consistent footer with automatic page numbers
  const drawPageFooter = (pageNumber: number) => {
    doc.setFont("helvetica", "normal");
    doc.setFontSize(8);
    doc.setDrawColor(226, 232, 240); // very soft gray
    doc.setLineWidth(0.2);
    doc.line(marginX, pageHeight - 15, pageWidth - marginX, pageHeight - 15);

    doc.setTextColor(148, 163, 184); // Slate-400 text
    doc.text(
      "CONFIDENTIAL - SYNTHETIC SMC ANALYTICA REPORT",
      marginX,
      pageHeight - 11
    );
    
    doc.text(
      `Date: ${new Date(trade.created_at).toLocaleDateString()} | Page ${pageNumber}`,
      pageWidth - marginX,
      pageHeight - 11,
      { align: "right" }
    );
  };

  // Safe offset management to support multipage printing dynamically
  let currentPage = 1;
  const ensureVerticalSpace = (spaceNeeded: number) => {
    if (yOffset + spaceNeeded > pageHeight - 18) {
      doc.addPage();
      currentPage++;
      drawPageBorder();
      drawPageFooter(currentPage);
      
      // Draw secondary header bar
      doc.setFillColor(15, 23, 42); // slate 900
      doc.rect(marginX, 15, printableWidth, 10, "F");
      doc.setFont("helvetica", "bold");
      doc.setFontSize(9);
      doc.setTextColor(253, 224, 71); // amber 300
      doc.text(`SMC JOURNAL DETAILED SPECIFICATION | LOG ID: ${trade.id.slice(0, 8).toUpperCase()}`, marginX + 4, 21.5);
      
      yOffset = 32; // Reset printing offset below header
    }
  };

  // --- START PDF DRAWING ---
  drawPageBorder();
  drawPageFooter(currentPage);

  // 1. BRANDING & HEADER BLOCK
  // Background title accent block
  doc.setFillColor(15, 23, 42); // Deep navy Slate-900 block
  doc.rect(marginX, yOffset, printableWidth, 22, "F");
  
  // Gold Left edge identifier line
  doc.setFillColor(245, 158, 11); // Amber-500
  doc.rect(marginX, yOffset, 2, 22, "F");

  // Title Text inside block
  doc.setFont("helvetica", "bold");
  doc.setFontSize(15);
  doc.setTextColor(255, 255, 255);
  doc.text("SYNTHETIC SMC TRADER", marginX + 6, yOffset + 9);
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(148, 163, 184); // Slate-400
  doc.text("Algorithmic Market Imbalance & Structural Report", marginX + 6, yOffset + 16);

  // Document Badge (top right)
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(pageWidth - marginX - 52, yOffset + 5, 48, 12, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(245, 158, 11); // Amber accent
  doc.text("REPORT SPECIFICATION", pageWidth - marginX - 28, yOffset + 10, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  doc.setTextColor(255, 255, 255);
  doc.text(`ID: #${trade.id.slice(0, 16).toUpperCase()}`, pageWidth - marginX - 28, yOffset + 14, { align: "center" });

  yOffset += 28;

  // 2. CORE TRADE METRICS TABLE (GRID)
  // Standard structured details table with responsive vertical bounds
  ensureVerticalSpace(38);
  
  const colW = printableWidth / 4; // Equal columns width
  const rowHeight = 8;
  const gridY = yOffset;

  // Grid background header row
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(marginX, gridY, printableWidth, rowHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("TRADING SYMBOL", marginX + colW * 0.5, gridY + 5.5, { align: "center" });
  doc.text("TIMEFRAME", marginX + colW * 1.5, gridY + 5.5, { align: "center" });
  doc.text("MARKET BIAS", marginX + colW * 2.5, gridY + 5.5, { align: "center" });
  doc.text("SETTLED STATUS", marginX + colW * 3.5, gridY + 5.5, { align: "center" });

  // Grid Values Row 1
  doc.setDrawColor(226, 232, 240);
  doc.setLineWidth(0.2);
  doc.setFillColor(248, 250, 252); // soft offwhite light row
  doc.rect(marginX, gridY + rowHeight, printableWidth, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9.5);
  doc.setTextColor(15, 23, 42); // Slate-900
  doc.text(trade.symbol, marginX + colW * 0.5, gridY + rowHeight + 5.5, { align: "center" });
  
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(trade.timeframe, marginX + colW * 1.5, gridY + rowHeight + 5.5, { align: "center" });
  
  // Highlight Bias Box
  let isBullish = trade.bias.toUpperCase() === "BULLISH";
  if (isBullish) {
    doc.setTextColor(16, 185, 129); // Emerald
  } else {
    doc.setTextColor(244, 63, 94); // Rose
  }
  doc.setFont("helvetica", "bold");
  doc.text(trade.bias, marginX + colW * 2.5, gridY + rowHeight + 5.5, { align: "center" });

  // Highlight Status Badge
  const stat = trade.status.toUpperCase();
  let statusBg = [245, 158, 11]; // amber-500 default
  let statusText = [255, 255, 255];
  if (stat === "WON") statusBg = [16, 185, 129]; // emerald
  else if (stat === "LOST") statusBg = [244, 63, 94]; // rose
  else if (stat === "BREAKEAVEN") statusBg = [100, 116, 139]; // slate 500

  doc.setFillColor(statusBg[0], statusBg[1], statusBg[2]);
  doc.rect(marginX + colW * 3 + 6, gridY + rowHeight + 1.5, colW - 12, 5, "F");
  
  doc.setFont("helvetica", "bold");
  doc.setFontSize(8);
  doc.setTextColor(statusText[0], statusText[1], statusText[2]);
  doc.text(stat, marginX + colW * 3.5, gridY + rowHeight + 5, { align: "center" });

  // Parameter Price Headers (Row 2 Header)
  doc.setFillColor(30, 41, 59); // Slate-800
  doc.rect(marginX, gridY + (rowHeight * 2), printableWidth, rowHeight, "F");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(8.5);
  doc.setTextColor(255, 255, 255);
  doc.text("ENTRY TARGET", marginX + colW * 0.5, gridY + (rowHeight * 2) + 5.5, { align: "center" });
  doc.text("STOP LOSS (INVALIDATION)", marginX + colW * 1.5, gridY + (rowHeight * 2) + 5.5, { align: "center" });
  doc.text("TAKE PROFIT (TARGET)", marginX + colW * 2.5, gridY + (rowHeight * 2) + 5.5, { align: "center" });
  doc.text("RISK : REWARD MATCH", marginX + colW * 3.5, gridY + (rowHeight * 2) + 5.5, { align: "center" });

  // Parameter Price Values (Row 2 Content)
  doc.setFillColor(248, 250, 252);
  doc.rect(marginX, gridY + (rowHeight * 3), printableWidth, rowHeight, "FD");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.setTextColor(15, 23, 42);
  doc.text(trade.entry_price.toLocaleString(undefined, { minimumFractionDigits: 1 }), marginX + colW * 0.5, gridY + (rowHeight * 3) + 5.5, { align: "center" });
  
  doc.setTextColor(244, 63, 94); // Stop loss is red
  doc.text(trade.stop_loss.toLocaleString(undefined, { minimumFractionDigits: 1 }), marginX + colW * 1.5, gridY + (rowHeight * 3) + 5.5, { align: "center" });
  
  doc.setTextColor(16, 185, 129); // Take profit is green
  doc.text(trade.take_profit.toLocaleString(undefined, { minimumFractionDigits: 1 }), marginX + colW * 2.5, gridY + (rowHeight * 3) + 5.5, { align: "center" });
  
  doc.setTextColor(245, 158, 11); // RR is Amber
  doc.text(trade.risk_reward || "N/A", marginX + colW * 3.5, gridY + (rowHeight * 3) + 5.5, { align: "center" });

  yOffset += (rowHeight * 4) + 6;

  // 3. CHART SCREENSHOT CONTEXT BLOCK
  if (trade.image_url) {
    ensureVerticalSpace(75);
    
    // Header for chart snapshot
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("REGISTERED CHART SNAPSHOT", marginX, yOffset);
    
    yOffset += 3.5;
    
    // Background placeholder frame
    doc.setDrawColor(203, 213, 225); // Slate 300
    doc.setLineWidth(0.4);
    
    const chartHeight = 55;
    doc.rect(marginX, yOffset, printableWidth, chartHeight);

    try {
      // Clean image data string
      let rawImg = trade.image_url;
      let format: "JPEG" | "PNG" = "JPEG";
      if (rawImg.includes("image/png")) {
        format = "PNG";
      }
      
      // Inject chart image dynamically within secure dimensions
      doc.addImage(
        rawImg, 
        format, 
        marginX + 1, 
        yOffset + 1, 
        printableWidth - 2, 
        chartHeight - 2, 
        trade.id, 
        "FAST"
      );
    } catch (err) {
      console.warn("Failed to embed screenshot base64 streams directly into jsPDF:", err);
      doc.setFont("helvetica", "italic");
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text("Screenshot stream was stored securely but has failed to convert local canvas rendering dimensions.", marginX + 10, yOffset + (chartHeight / 2));
    }
    
    yOffset += chartHeight + 8;
  }

  // 4. TRADER COMMENTS & NOTES
  if (trade.notes && trade.notes.trim()) {
    // Dynamically calculate wrapped notes paragraphs height using Helvetica font metrics
    doc.setFont("helvetica", "normal");
    doc.setFontSize(9);
    const splitNotes = doc.splitTextToSize(trade.notes, printableWidth - 8);
    const boxHeight = (splitNotes.length * 4.5) + 12;

    ensureVerticalSpace(boxHeight);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("TRADER CHRONICLE & EXECUTION LOGS", marginX, yOffset);

    yOffset += 3.5;

    // Draw solid elegant slate comment box
    doc.setFillColor(241, 245, 249); // light blue-gray
    doc.rect(marginX, yOffset, printableWidth, boxHeight - 2, "F");
    
    // Accent gold highlight on left border
    doc.setFillColor(245, 158, 11);
    doc.rect(marginX, yOffset, 1.2, boxHeight - 2, "F");

    doc.setFont("helvetica", "italic");
    doc.setFontSize(8.5);
    doc.setTextColor(51, 65, 85); // Slate 700
    
    // Print wrapped notes safely
    let lineY = yOffset + 6;
    for (let k = 0; k < splitNotes.length; k++) {
      doc.text(splitNotes[k], marginX + 5, lineY);
      lineY += 4.5;
    }

    yOffset += boxHeight + 6;
  }

  // 5. GEMINI SMC POWERED FINDINGS AI LAYER
  if (trade.analysis_info) {
    const ai = trade.analysis_info;
    
    ensureVerticalSpace(12);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10.5);
    doc.setTextColor(15, 23, 42); // slate 900
    
    // Sparkle badge indicator
    doc.setFillColor(224, 242, 254); // light sky-200
    doc.rect(marginX, yOffset - 4, 38, 5, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(7.5);
    doc.setTextColor(2, 132, 199); // sky-700
    doc.text("GEMINI CO-PILOT AI", marginX + 3, yOffset - 0.5);

    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(30, 41, 59);
    doc.text("ALGORITHMIC SMART MONEY CONCEPTS (SMC) DEPLOYMENT", marginX + 41, yOffset - 0.2);

    yOffset += 3.5;

    // A. Sub-Details Grid Layout
    ensureVerticalSpace(28);
    const subColW = printableWidth / 2;
    const itemHeight = 6.8;
    let gridA_Y = yOffset;

    // Detail Cell 1: Market Structure
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX, gridA_Y, subColW - 2, itemHeight * 3, "FD");
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("MARKET STRUCTURE BIAS", marginX + 4, gridA_Y + 5);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(30, 41, 59);
    doc.text(ai.marketStructure || "BOS / CHoCH Scanner Online", marginX + 4, gridA_Y + 11);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    doc.text("Detection of Breaks-of-Structure & Character Shifts", marginX + 4, gridA_Y + 16);

    // Detail Cell 2: Order Blocks
    doc.setFillColor(248, 250, 252);
    doc.rect(marginX + subColW + 2, gridA_Y, subColW - 2, itemHeight * 3, "FD");

    doc.setFont("helvetica", "bold");
    doc.setFontSize(8.5);
    doc.setTextColor(71, 85, 105);
    doc.text("PRIMARY MITIGATION ORDER BLOCK (OB)", marginX + subColW + 6, gridA_Y + 5);
    
    doc.setFont("helvetica", "bold");
    doc.setFontSize(9);
    doc.setTextColor(124, 58, 237); // violet
    doc.text(ai.orderBlock?.priceRange || "Undetected / Secondary Sweep", marginX + subColW + 6, gridA_Y + 11);
    
    doc.setFont("helvetica", "normal");
    doc.setFontSize(7.5);
    doc.setTextColor(100, 116, 139);
    const obType = ai.orderBlock?.type ? `OB Segment: ${ai.orderBlock.type}` : "Price block representing high institutional liquidity pooling";
    doc.text(obType, marginX + subColW + 6, gridA_Y + 16);

    yOffset += (itemHeight * 3) + 4;

    // Supply and Demand Zone Analysis findings
    if (ai.supplyDemandZones) {
      ensureVerticalSpace(24);
      let sY = yOffset;

      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, sY, printableWidth, 18, "FD");

      // vertical red/green controller blocks
      doc.setFillColor(220, 38, 38); // Red supply
      doc.rect(marginX, sY, 1.2, 9, "F");
      
      doc.setFillColor(16, 185, 129); // Green demand
      doc.rect(marginX, sY + 9, 1.2, 9, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(71, 85, 105);
      doc.text("INSTITUTIONAL SUPPLY ZONE", marginX + 4, sY + 5.5);
      doc.text("INSTITUTIONAL DEMAND ZONE", marginX + subColW + 6, sY + 5.5);

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(194, 65, 12); // dark orange
      doc.text(ai.supplyDemandZones.supply || "N/A", marginX + 4, sY + 12);
      doc.setTextColor(4, 120, 87); // dark emerald
      doc.text(ai.supplyDemandZones.demand || "N/A", marginX + subColW + 6, sY + 12);

      // Active zone highlighter
      doc.setFont("helvetica", "normal");
      doc.setFontSize(7.5);
      doc.setTextColor(100, 116, 139);
      doc.text(`Active control zone: ${ai.supplyDemandZones.activeZone}`, marginX + 4, sY + 16);

      yOffset += 24;
    }

    // Trace setup targets & Rationale
    if (ai.tradeSetup) {
      const setup = ai.tradeSetup;

      // Wrap setup rationale
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      const splitRationale = doc.splitTextToSize(
        setup.rationale || "N/A", 
        printableWidth - 10
      );
      const ratHeight = (splitRationale.length * 4.2) + 16;

      ensureVerticalSpace(ratHeight);

      doc.setFillColor(248, 250, 252);
      doc.rect(marginX, yOffset, printableWidth, ratHeight, "FD");
      
      // left slate border
      doc.setFillColor(30, 41, 59);
      doc.rect(marginX, yOffset, 1.2, ratHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8.5);
      doc.setTextColor(15, 23, 42);
      doc.text("AI ALGORITHMIC SETUP RATIONALE & LIQUIDITY MATRIX", marginX + 4, yOffset + 6);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8.5);
      doc.setTextColor(51, 65, 85);
      
      let ratY = yOffset + 12;
      for (let j = 0; j < splitRationale.length; j++) {
        doc.text(splitRationale[j], marginX + 4, ratY);
        ratY += 4.2;
      }

      yOffset += ratHeight + 6;
    }

    // B. AI Educational Insights (Amber alert block)
    if (ai.educationalInsight && ai.educationalInsight.trim()) {
      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      const splitInsight = doc.splitTextToSize(ai.educationalInsight, printableWidth - 12);
      const insHeight = (splitInsight.length * 4) + 14;

      ensureVerticalSpace(insHeight);

      doc.setFillColor(254, 243, 199); // Amber 100 bg
      doc.setDrawColor(245, 158, 11); // Amber 500 edge
      doc.setLineWidth(0.3);
      doc.rect(marginX, yOffset, printableWidth, insHeight, "FD");

      doc.setFillColor(245, 158, 11); // solid left highlight
      doc.rect(marginX, yOffset, 1.2, insHeight, "F");

      doc.setFont("helvetica", "bold");
      doc.setFontSize(8);
      doc.setTextColor(180, 83, 9); // Amber 800 title
      doc.text("SMC CO-PILOT EDUCATIONAL DRILL: ADVANCED DISCIPLINE", marginX + 4, yOffset + 5);

      doc.setFont("helvetica", "normal");
      doc.setFontSize(8);
      doc.setTextColor(120, 53, 4); // Amber 900 content
      
      let insY = yOffset + 10;
      for (let i = 0; i < splitInsight.length; i++) {
        doc.text(splitInsight[i], marginX + 4, insY);
        insY += 4;
      }

      yOffset += insHeight + 6;
    }
  }

  // Final metadata signpost
  ensureVerticalSpace(16);
  
  doc.setFont("helvetica", "italic");
  doc.setFontSize(7.5);
  doc.setTextColor(148, 163, 184); // Slate 400
  doc.text(
    "* Disclaimer: All reports and drawings are synthesized programmatically using artificial pattern recognition models and local system assets. Always run proper independent risk verification prior to allocating real parameters.", 
    marginX, 
    yOffset
  );

  // Trigger browser download action with localized descriptive slug
  const titleSlug = trade.symbol.toLowerCase().replace(/[^a-z0-9]/g, "-");
  const fileName = `smc-report-${titleSlug}-${new Date(trade.created_at).toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}
