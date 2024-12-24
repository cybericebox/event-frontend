'use client'
import {useCallback, useRef} from 'react';


interface useInViewProps extends IntersectionObserverInit {
    onInView?: () => void;
    onNotInView?: () => void;
    isLoading: boolean
    deps?: any[]
}

export function useInView({onInView, onNotInView, isLoading, deps = [], ...options}: useInViewProps):
    {
        ref: (node: any) => void
    } {

    const observer = useRef<IntersectionObserver>();

    const lastElementRef = useCallback((node: any) => {
        if (isLoading) return;
        if (observer.current) observer.current.disconnect();

        observer.current = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting && onInView) {
                onInView()
            }
            if (!entries[0].isIntersecting && onNotInView) {
                onNotInView()
            }
        }, options);

        if (node) observer.current.observe(node);
    }, [isLoading, ...deps])

    return {
        ref: lastElementRef
    }
}