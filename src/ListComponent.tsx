import { useMemo } from "react";
import * as React from "react";
import {
    Animated,
    type LayoutChangeEvent,
    type NativeScrollEvent,
    type NativeSyntheticEvent,
    ScrollView,
    type ScrollViewProps,
    View,
    type ViewStyle,
} from "react-native";
import { Containers } from "./Containers";
import { ListHeaderComponentContainer } from "./ListHeaderComponentContainer";
import { ScrollAdjust } from "./ScrollAdjust";
import type { ScrollAdjustHandler } from "./ScrollAdjustHandler";
import { ENABLE_DEVMODE } from "./constants";
import { set$, useStateContext } from "./state";
import { type GetRenderedItem, type LegendListProps, typedMemo } from "./types";
import { useValue$ } from "./useValue$";

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
    handleScroll: (event: NativeSyntheticEvent<NativeScrollEvent>) => void;
    onLayout: (event: LayoutChangeEvent) => void;
    maintainVisibleContentPosition: boolean;
    renderScrollComponent?: (props: ScrollViewProps) => React.ReactElement<ScrollViewProps>;
    style: ViewStyle;
    canRender: boolean;
    scrollAdjustHandler: ScrollAdjustHandler;
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
    const animPaddingTop = useValue$("paddingTop", { delay: 0 });

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
    handleScroll,
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
    ...rest
}: ListComponentProps<ItemT>) {
    const ctx = useStateContext();

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

    return (
        <ScrollComponent
            {...rest}
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
            onScroll={handleScroll}
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
                <ListHeaderComponentContainer
                    style={ListHeaderComponentStyle}
                    ctx={ctx}
                    horizontal={horizontal}
                    waitForInitialLayout={waitForInitialLayout}
                >
                    {getComponent(ListHeaderComponent)}
                </ListHeaderComponentContainer>
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
        </ScrollComponent>
    );
});
