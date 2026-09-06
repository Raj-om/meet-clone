import { useState, useEffect, RefObject } from 'react';

interface GridDimensions {
  cols: number;
  rows: number;
  tileWidth: number;
  tileHeight: number;
}

export function useOptimalGrid(
  containerRef: RefObject<HTMLElement | null>,
  itemCount: number,
  aspectRatio: number = 16 / 9,
  gap: number = 12
): GridDimensions {
  const [dimensions, setDimensions] = useState<GridDimensions>({
    cols: 1,
    rows: 1,
    tileWidth: 0,
    tileHeight: 0,
  });

  useEffect(() => {
    if (!containerRef.current || itemCount === 0) return;

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect;
        let bestCols = 1;
        let bestRows = 1;
        let maxArea = 0;
        let bestTileWidth = 0;
        let bestTileHeight = 0;

        // Try different column layouts from 1 to itemCount
        for (let cols = 1; cols <= itemCount; cols++) {
          const rows = Math.ceil(itemCount / cols);
          
          // Calculate max width per tile taking gaps into account
          const maxAvailableWidth = width - (cols - 1) * gap;
          const maxAvailableHeight = height - (rows - 1) * gap;

          // Constraints
          let tileWidth = maxAvailableWidth / cols;
          let tileHeight = tileWidth / aspectRatio;

          if (tileHeight * rows > maxAvailableHeight) {
            // Height constrained
            tileHeight = maxAvailableHeight / rows;
            tileWidth = tileHeight * aspectRatio;
          }

          const area = tileWidth * tileHeight;
          if (area > maxArea) {
            maxArea = area;
            bestCols = cols;
            bestRows = rows;
            bestTileWidth = tileWidth;
            bestTileHeight = tileHeight;
          }
        }

        setDimensions({
          cols: bestCols,
          rows: bestRows,
          tileWidth: bestTileWidth,
          tileHeight: bestTileHeight,
        });
      }
    });

    observer.observe(containerRef.current);
    
    // Initial calculation
    const rect = containerRef.current.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) {
        let bestCols = 1;
        let bestRows = 1;
        let maxArea = 0;
        let bestTileWidth = 0;
        let bestTileHeight = 0;

        for (let cols = 1; cols <= itemCount; cols++) {
            const rows = Math.ceil(itemCount / cols);
            const maxAvailableWidth = rect.width - (cols - 1) * gap;
            const maxAvailableHeight = rect.height - (rows - 1) * gap;

            let tileWidth = maxAvailableWidth / cols;
            let tileHeight = tileWidth / aspectRatio;

            if (tileHeight * rows > maxAvailableHeight) {
            tileHeight = maxAvailableHeight / rows;
            tileWidth = tileHeight * aspectRatio;
            }

            const area = tileWidth * tileHeight;
            if (area > maxArea) {
            maxArea = area;
            bestCols = cols;
            bestRows = rows;
            bestTileWidth = tileWidth;
            bestTileHeight = tileHeight;
            }
        }

        setDimensions({
            cols: bestCols,
            rows: bestRows,
            tileWidth: bestTileWidth,
            tileHeight: bestTileHeight,
        });
    }

    return () => observer.disconnect();
  }, [containerRef, itemCount, aspectRatio, gap]);

  return dimensions;
}
