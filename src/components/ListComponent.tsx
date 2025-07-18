import * as React from "react";
import { useMemo } from "react";
import {
    Animated,
    type LayoutChangeEvent,
    type LayoutRectangle,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    type ScrollViewProps,
    View,
    type ViewStyle,
} from "react-native";

import { Containers } from "@/components/Containers";
import { ScrollAdjust } from "@/components/ScrollAdjust";
import { SnapWrapper } from "@/components/SnapWrapper";
import { ENABLE_DEVMODE } from "@/constants";
import type { ScrollAdjustHandler } from "@/core/ScrollAdjustHandler";
import { useSyncLayout } from "@/hooks/useSyncLayout";
import { useValue$ } from "@/hooks/useValue$";
import { set$, useStateContext } from "@/state/state";
import { type GetRenderedItem, type LegendListProps, typedMemo } from "@/types";

interface ListComponentProps<ItemT>
    extends Omit<
        LegendListProps<ItemT> & { scrollEventThrottle: number | undefined },
        | "data"
        | "estimatedItemSize"
        | "drawDistance"
        | "maintainScrollAtEnd"
        | "maintainScrollAtEndThreshold"
        | "maintainVisibleContentPosition"
        | "style"
    > {
    horizontal: boolean;
    initialContentOffset: number | undefined;
    refScrollView: React.Ref<ScrollView>;
    getRenderedItem: GetRenderedItem;
    updateItemSize: (itemKey: string, size: { width: number; height: number }) => void;
    onScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    onLayoutHeader: (rect: LayoutRectangle, fromLayoutEffect: boolean) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    style: ViewStyle;
    canRender: boolean;
    scrollAdjustHandler: ScrollAdjustHandler;
    snapToIndices: number[] | undefined;
}

const getComponent = (Component: React.ComponentType<any> | React.ReactElement) => {
    if (React.isValidElement<any>(Component)) {
        return Component;
    }
    if (Component) {
        return <Component />;
    }
    return null;
};

const Padding = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return <Animated.View style={{ paddingTop: animPaddingTop }} />;
};

const PaddingDevMode = () => {
    const animPaddingTop = useValue$("alignItemsPaddingTop", { delay: 0 });

    return (
        <>
            <Animated.View style={{ paddingTop: animPaddingTop }} />
            <Animated.View
                style={{
                    position: "absolute",
                    top: 0,
                    height: animPaddingTop,
                    left: 0,
                    right: 0,
                    backgroundColor: "green",
                }}
            />
        </>
    );
};

export const ListComponent = typedMemo(function ListComponent<ItemT>({
    canRender,
    style,
    contentContainerStyle,
    horizontal,
    initialContentOffset,
    recycleItems,
    ItemSeparatorComponent,
    alignItemsAtEnd,
    waitForInitialLayout,
    onScroll,
    onLayout,
    ListHeaderComponent,
    ListHeaderComponentStyle,
    ListFooterComponent,
    ListFooterComponentStyle,
    ListEmptyComponent,
    getRenderedItem,
    updateItemSize,
    refScrollView,
    maintainVisibleContentPosition,
    renderScrollComponent,
    scrollAdjustHandler,
    onLayoutHeader,
    snapToIndices,
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();
    const { onLayout: onLayoutHeaderSync, ref: refHeader } = useSyncLayout({
        onChange: onLayoutHeader,
    });

    // Use renderScrollComponent if provided, otherwise a regular ScrollView
    const ScrollComponent = renderScrollComponent
        ? useMemo(
              () => React.forwardRef((props, ref) => renderScrollComponent({ ...props, ref } as any)),
              [renderScrollComponent],
          )
        : ScrollView;

    React.useEffect(() => {
        if (canRender) {
            setTimeout(() => {
                scrollAdjustHandler.setMounted();
            }, 0);
        }
    }, [canRender]);

    const SnapOrScroll = snapToIndices ? SnapWrapper : ScrollComponent;

    return (
        <SnapOrScroll
            {...rest}
            ScrollComponent={snapToIndices ? ScrollComponent : (undefined as any)}
            style={style}
            maintainVisibleContentPosition={
                maintainVisibleContentPosition && !ListEmptyComponent ? { minIndexForVisible: 0 } : undefined
            }
            contentContainerStyle={[
                contentContainerStyle,
                horizontal
                    ? {
                          height: "100%",
                      }
                    : {},
            ]}
            onScroll={onScroll}
            onLayout={onLayout}
            horizontal={horizontal}
            contentOffset={
                initialContentOffset
                    ? horizontal
                        ? { x: initialContentOffset, y: 0 }
                        : { x: 0, y: initialContentOffset }
                    : undefined
            }
            ref={refScrollView as any}
        >
            {maintainVisibleContentPosition && <ScrollAdjust />}
            {ENABLE_DEVMODE ? <PaddingDevMode /> : <Padding />}
            {ListHeaderComponent && (
                <View style={ListHeaderComponentStyle} onLayout={onLayoutHeaderSync} ref={refHeader}>
                    {getComponent(ListHeaderComponent)}
                </View>
            )}
            {ListEmptyComponent && getComponent(ListEmptyComponent)}

            {canRender && (
                <Containers
                    horizontal={horizontal!}
                    recycleItems={recycleItems!}
                    waitForInitialLayout={waitForInitialLayout}
                    getRenderedItem={getRenderedItem}
                    ItemSeparatorComponent={ItemSeparatorComponent}
                    updateItemSize={updateItemSize}
                />
            )}
            {ListFooterComponent && (
                <View
                    style={ListFooterComponentStyle}
                    onLayout={(event) => {
                        const size = event.nativeEvent.layout[horizontal ? "width" : "height"];
                        set$(ctx, "footerSize", size);
                    }}
                >
                    {getComponent(ListFooterComponent)}
                </View>
            )}
        </SnapOrScroll>
    );
});
