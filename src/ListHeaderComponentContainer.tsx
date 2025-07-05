// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { type StateContext, peek$, set$ } from "./state";
import { useValue$ } from "./useValue$";

interface ListHeaderComponentContainerProps {
    children: React.ReactNode;
    style: StyleProp<ViewStyle>;
    ctx: StateContext;
    horizontal: boolean;
    waitForInitialLayout: boolean | undefined;
}

export function ListHeaderComponentContainer({
    children,
    style,
    ctx,
    horizontal,
    waitForInitialLayout,
}: ListHeaderComponentContainerProps) {
    const hasData = peek$(ctx, "lastItemKeys")?.length > 0;
    const scrollAdjust = useValue$("scrollAdjust", { getValue: (v) => v ?? 0, delay: 0 });
    const animOpacity = waitForInitialLayout
        ? useValue$("containersDidLayout", { getValue: (value) => (value ? 1 : 0) })
        : undefined;
    const additionalSize: ViewStyle = {
        transform: [{ translateY: Animated.multiply(scrollAdjust, -1) }],
        // Header should show if there's no data yet, but containersDidLayout will be false until it has some data
        opacity: hasData ? animOpacity : 1,
    };

    return (
        <Animated.View
            style={[style, additionalSize]}
            onLayout={(event) => {
                const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                set$(ctx, "headerSize", size);
            }}
        >
            {children}
        </Animated.View>
    );
}
