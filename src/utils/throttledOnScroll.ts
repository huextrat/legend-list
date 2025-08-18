import type { NativeScrollEvent } from "react-native";

import { useThrottleDebounce } from "@/hooks/useThrottleDebounce";

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
    const throttle = useThrottleDebounce("throttle");

    return (event: { nativeEvent: NativeScrollEvent }) => {
        throttle(originalHandler, scrollEventThrottle, event);
    };
}
