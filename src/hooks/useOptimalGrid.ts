import { useState, useEffect, RefObject, useCallback } from 'react';

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
  const [dimensions, setDimensions] = useState<GridDimensions>(() => {
    // Sane initial default based on viewport if available
    if (typeof window !== 'undefined') {
      const w = Math.min(window.innerWidth * 0.7, 960);
      const h = Math.min(window.innerHeight * 0.6, 540);
      return {
        cols: 1,
        rows: 1,
        tileWidth: Math.floor(w),
        tileHeight: Math.floor(w / aspectRatio),
      };
    }
    return { cols: 1, rows: 1, tileWidth: 640, tileHeight: 360 };
  });

  const computeOptimal = useCallback((width: number, height: number, count: number) => {
    if (width <= 0 || height <= 0 || count <= 0) return null;

    let bestCols = 1;
    let bestRows = 1;
    let maxArea = 0;
    let bestTileWidth = 0;
    let bestTileHeight = 0;

    for (let cols = 1; cols <= count; cols++) {
      const rows = Math.ceil(count / cols);
      const maxAvailableWidth = width - (cols - 1) * gap;
      const maxAvailableHeight = height - (rows - 1) * gap;

      if (maxAvailableWidth <= 0 || maxAvailableHeight <= 0) continue;

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
        bestTileWidth = Math.floor(tileWidth);
        bestTileHeight = Math.floor(tileHeight);
      }
    }

    if (bestTileWidth > 20 && bestTileHeight > 20) {
      return {
        cols: bestCols,
        rows: bestRows,
        tileWidth: bestTileWidth,
        tileHeight: bestTileHeight,
      };
    }
    return null;
  }, [aspectRatio, gap]);

  useEffect(() => {
    const effectiveCount = Math.max(itemCount, 1);
    let observer: ResizeObserver | null = null;
    let checkInterval: NodeJS.Timeout | null = null;

    const measure = () => {
      const el = containerRef.current;
      if (!el) return false;

      const rect = el.getBoundingClientRect();
      const width = rect.width || el.clientWidth || (typeof window !== 'undefined' ? window.innerWidth * 0.7 : 0);
      const height = rect.height || el.clientHeight || (typeof window !== 'undefined' ? window.innerHeight * 0.6 : 0);

      const optimal = computeOptimal(width, height, effectiveCount);
      if (optimal) {
        setDimensions(optimal);
        return true;
      }
      return false;
    };

    // Attach ResizeObserver if container is already mounted
    if (containerRef.current) {
      measure();
      observer = new ResizeObserver((entries) => {
        for (const entry of entries) {
          const { width, height } = entry.contentRect;
          const optimal = computeOptimal(width, height, effectiveCount);
          if (optimal) {
            setDimensions(optimal);
          }
        }
      });
      observer.observe(containerRef.current);
    } else {
      // If container not mounted yet (e.g. ModeSelectionScreen conditional render),
      // poll every 100ms until mounted
      checkInterval = setInterval(() => {
        if (containerRef.current) {
          measure();
          observer = new ResizeObserver((entries) => {
            for (const entry of entries) {
              const { width, height } = entry.contentRect;
              const optimal = computeOptimal(width, height, effectiveCount);
              if (optimal) {
                setDimensions(optimal);
              }
            }
          });
          observer.observe(containerRef.current);
          if (checkInterval) clearInterval(checkInterval);
        }
      }, 100);
    }

    const handleWindowResize = () => {
      measure();
    };
    window.addEventListener('resize', handleWindowResize);

    return () => {
      if (observer) observer.disconnect();
      if (checkInterval) clearInterval(checkInterval);
      window.removeEventListener('resize', handleWindowResize);
    };
  }, [containerRef, itemCount, computeOptimal]);

  return dimensions;
}
