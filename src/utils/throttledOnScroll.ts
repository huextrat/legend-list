import type { NativeScrollEvent } from "react-native";

/**
 * Creates a throttled scroll event handler that respects the scrollEventThrottle interval.
 * This matches ScrollView's behavior where:
 * - scrollEventThrottle = 0 or undefined: No throttling (fires on every scroll event)
 * - scrollEventThrottle > 0: Throttles events to fire at most once per interval
 *
 * The implementation uses trailing edge throttling to ensure the last scroll event
 * is always fired, which is important for accurate final scroll position tracking.
 */
export function throttledOnScroll(
    originalHandler: (event: { nativeEvent: NativeScrollEvent }) => void,
    scrollEventThrottle: number,
): (event: { nativeEvent: NativeScrollEvent }) => void {
    let lastCallTime = 0;
    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let lastEvent: { nativeEvent: NativeScrollEvent } | null = null;

    return (event: { nativeEvent: NativeScrollEvent }) => {
        const now = Date.now();
        lastEvent = event;

        if (now - lastCallTime >= scrollEventThrottle) {
            lastCallTime = now;
            originalHandler(event);

            // Clear any pending timeout since we just fired
            if (timeoutId) {
                clearTimeout(timeoutId);
                timeoutId = null;
            }
        } else {
            // Clear existing timeout and set a new one
            if (timeoutId) {
                clearTimeout(timeoutId);
            }

            timeoutId = setTimeout(
                () => {
                    if (lastEvent) {
                        lastCallTime = Date.now();
                        originalHandler(lastEvent);
                        timeoutId = null;
                        lastEvent = null;
                    }
                },
                scrollEventThrottle - (now - lastCallTime),
            );
        }
    };
}
