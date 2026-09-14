const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

const replacement = `
      // Compress images before sending to Vercel (to avoid 4.5MB Payload Too Large error)
      let compressedImages = [];
      let compressedTargetImage = targetImage;
      
      if (isMtfMode) {
        compressedImages = await Promise.all([
          compressImage(mtfImages.m30.preview),
          compressImage(mtfImages.h4.preview),
          compressImage(mtfImages.d1.preview)
        ]);
      } else if (targetImage) {
        compressedTargetImage = await compressImage(targetImage);
      }

      const requestBody = isMtfMode
        ? {
            images: compressedImages,
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: "30M", // Primary focus
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice
          }
        : {
            image: compressedTargetImage,
            symbol: customSymbolText ? customSymbolText : symbol.name,
            timeframe: timeframe,
            tradeHistory: trades,
            learnings: learningsData,
            currentPrice: currentPrice
          };
`;

code = code.replace(/const requestBody = isMtfMode[\s\S]*?currentPrice\n          };/, replacement.trim());
fs.writeFileSync('src/App.tsx', code);
