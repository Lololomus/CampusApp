// ===== 📄 ФАЙЛ: frontend/src/hooks/useSwipe.js =====
import { useRef } from 'react';

export const useSwipe = ({ 
    elementRef,
    onSwipeDown,
    onSwipeRight,
    onSwipeLeft,
    threshold = 100,
    isModal = false
}) => {
    const startPos = useRef({ x: 0, y: 0 });
    const currentOffset = useRef({ x: 0, y: 0 });
    const isSwiping = useRef(false);
    const directionLocked = useRef(null);
    const isMouseDown = useRef(false);

    const getX = (e) => e.touches ? e.touches[0].clientX : e.clientX;
    const getY = (e) => e.touches ? e.touches[0].clientY : e.clientY;

    const onStart = (e) => {
        if (!e.touches) isMouseDown.current = true;
        
        startPos.current = { x: getX(e), y: getY(e) };
        isSwiping.current = true;
        directionLocked.current = null;
        
        if (elementRef.current) {
            elementRef.current.style.transition = 'none';
        }
    };

    const onMove = (e) => {
        if (!isSwiping.current) return;
        if (!e.touches && !isMouseDown.current) return;

        const deltaX = getX(e) - startPos.current.x;
        const deltaY = getY(e) - startPos.current.y;

        if (!directionLocked.current) {
            if (Math.abs(deltaX) > Math.abs(deltaY)) directionLocked.current = 'x';
            else directionLocked.current = 'y';
        }

        let translateX = 0;
        let translateY = 0;

        if (isModal) {
            if (deltaY < 0) translateY = deltaY * 0.2;
            else translateY = deltaY;
            
            if (directionLocked.current === 'x') return;
        } else {
            if (directionLocked.current === 'x') {
                translateX = deltaX;
            } else return;
        }

        if (elementRef.current) {
            const rotate = isModal ? 0 : translateX * 0.05;
            // ✅ translate3d вместо обычного translate
            elementRef.current.style.transform = 
                `translate3d(${translateX}px, ${translateY}px, 0) rotate(${rotate}deg)`;
        }
        
        currentOffset.current = { x: translateX, y: translateY };
    };

    const onEnd = () => {
        if (!isSwiping.current) return;
        isSwiping.current = false;
        isMouseDown.current = false;

        const { x, y } = currentOffset.current;

        if (elementRef.current) {
            elementRef.current.style.transition = 'transform 0.3s cubic-bezier(0.2, 0.8, 0.2, 1)';
        }

        let handled = false;

        if (isModal && y > threshold) {
             onSwipeDown?.();
             handled = true;
        } 
        else if (!isModal && Math.abs(x) > threshold) {
            if (x > 0) onSwipeRight?.();
            else onSwipeLeft?.();
            handled = true;
        }

        if (!handled && elementRef.current) {
            // ✅ translate3d вместо обычного translate
            elementRef.current.style.transform = 'translate3d(0, 0, 0) rotate(0deg)';
        }
        
        currentOffset.current = { x: 0, y: 0 };
    };

    return {
        onTouchStart: onStart,
        onTouchMove: onMove,
        onTouchEnd: onEnd,
        onMouseDown: onStart,
        onMouseMove: onMove,
        onMouseUp: onEnd,
        onMouseLeave: onEnd
    };
};