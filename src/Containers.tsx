// biome-ignore lint/style/useImportType: Leaving this out makes it crash in some environments
import * as React from "react";
import { Animated, type StyleProp, type ViewStyle } from "react-native";
import { Container } from "./Container";
import { IsNewArchitecture } from "./constants";
import { useArr$, useStateContext } from "./state";
import { type GetRenderedItem, typedMemo } from "./types";
import { useValue$ } from "./useValue$";

interface ContainersProps<ItemT> {
    horizontal: boolean;
    recycleItems: boolean;
    ItemSeparatorComponent?: React.ComponentType<{ leadingItem: ItemT }>;
    waitForInitialLayout: boolean | undefined;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    getRenderedItem: GetRenderedItem;
}

export const Containers = typedMemo(function Containers<ItemT>({
    horizontal,
    recycleItems,
    ItemSeparatorComponent,
    waitForInitialLayout,
    updateItemSize,
    getRenderedItem,
}: ContainersProps<ItemT>) {
    const ctx = useStateContext();
    const columnWrapperStyle = ctx.columnWrapperStyle;
    const [numContainers, numColumns] = useArr$(["numContainersPooled", "numColumns"]);
    const animSize = useValue$("totalSize", {
        // Use a microtask if increasing the size significantly, otherwise use a timeout
        delay: (value, prevValue) => (!prevValue || value - prevValue > 20 ? 0 : 200),
    });
    const animOpacity =
        waitForInitialLayout && !IsNewArchitecture
            ? useValue$("containersDidLayout", { getValue: (value) => (value ? 1 : 0) })
            : undefined;
    const otherAxisSize = useValue$("otherAxisSize", { delay: 0 });

    const containers: React.ReactNode[] = [];
    for (let i = 0; i < numContainers; i++) {
        containers.push(
            <Container
                id={i}
                key={i}
                recycleItems={recycleItems}
                horizontal={horizontal}
                getRenderedItem={getRenderedItem}
                updateItemSize={updateItemSize}
                // specifying inline separator makes Containers rerender on each data change
                // should we do memo of ItemSeparatorComponent?
                ItemSeparatorComponent={ItemSeparatorComponent}
            />,
        );
    }

    const style: StyleProp<ViewStyle> = horizontal
        ? { width: animSize, opacity: animOpacity, minHeight: otherAxisSize }
        : { height: animSize, opacity: animOpacity, minWidth: otherAxisSize };

    if (columnWrapperStyle && numColumns > 1) {
        // Extract gap properties from columnWrapperStyle if available
        const { columnGap, rowGap, gap } = columnWrapperStyle;

        const gapX = columnGap || gap || 0;
        const gapY = rowGap || gap || 0;
        if (horizontal) {
            if (gapY) {
                style.marginVertical = -gapY / 2;
            }
            if (gapX) {
                style.marginRight = -gapX;
            }
        } else {
            if (gapX) {
                style.marginHorizontal = -gapX;
            }
            if (gapY) {
                style.marginBottom = -gapY;
            }
        }
    }

    return <Animated.View style={style}>{containers}</Animated.View>;
});
