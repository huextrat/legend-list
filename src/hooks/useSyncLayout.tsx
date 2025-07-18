import { useCallback, useLayoutEffect, useRef, useState } from "react";
import type { LayoutChangeEvent, LayoutRectangle, View } from "react-native";

export function useSyncLayoutState<T extends View = View>({
    getValue,
    debounce,
    onChange: onChangeProp,
}: {
    getValue: (rectangle: LayoutRectangle) => number;
    debounce?: number | undefined;
    onChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}) {
    const debounceTimeoutRef = useRef<any>(null);
    const [value, setValue] = useState(0);

    const onChange = useCallback(
        (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => {
            const height = getValue(rectangle);

            if (debounce === undefined) {
                setValue(height);
            } else {
                // Clear previous timeout if it exists
                if (debounceTimeoutRef.current) {
                    clearTimeout(debounceTimeoutRef.current);
                }

                // Debounce the setViewHeight call
                debounceTimeoutRef.current = setTimeout(() => {
                    debounceTimeoutRef.current = null;
                    setValue(height);
                }, debounce);
            }

            onChangeProp?.(rectangle, fromLayoutEffect);
        },
        [getValue, debounce],
    );

    const { onLayout, ref } = useSyncLayout<T>({ onChange });

    return { onLayout, ref, value };
}

export function useSyncLayout<T extends View = View>({
    onChange,
}: {
    onChange: (rectangle: LayoutRectangle, fromLayoutEffect: boolean) => void;
}) {
    const ref = useRef<T | null>(null);

    const onLayout = useCallback(
        (event: LayoutChangeEvent) => {
            onChange(event.nativeEvent.layout, false);
        },
        [onChange],
    );

    useLayoutEffect(() => {
        if (ref.current) {
            ref.current.measure((x, y, width, height) => {
                onChange({ height, width, x, y }, true);
            });
        }
    }, []);

    return { onLayout, ref };
}
