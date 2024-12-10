import type { ComponentProps, ReactNode } from 'react';
import type { ScrollResponderMixin, ScrollViewComponent } from 'react-native';
import type { ScrollView, StyleProp, ViewStyle } from 'react-native';

export type LegendListProps<T> = Omit<ComponentProps<typeof ScrollView>, 'contentOffset'> & {
    data: ArrayLike<any> & T[];
    initialScrollOffset?: number;
    initialScrollIndex?: number;
    drawDistance?: number;
    initialNumContainers?: number;
    recycleItems?: boolean;
    onEndReachedThreshold?: number | null | undefined;
    onStartReachedThreshold?: number | null | undefined;
    maintainScrollAtEnd?: boolean;
    maintainScrollAtEndThreshold?: number;
    alignItemsAtEnd?: boolean;
    // in most cases providing a constant value for item size enough
    estimatedItemSize: number;
    // in case you have distinct item sizes, you can provide a function to get the size of an item
    // use instead of FlatList's getItemLayout or FlashList overrideItemLayout
    // if you want to have accurate initialScrollOffset, you should provide this function
    getEstimatedItemSize?: (index: number, item: T) => number;
    onEndReached?: ((info: { distanceFromEnd: number }) => void) | null | undefined;
    onStartReached?: ((info: { distanceFromStart: number }) => void) | null | undefined;
    keyExtractor?: (item: T, index: number) => string;
    renderItem?: (props: LegendListRenderItemProps<T>) => ReactNode;
    ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListHeaderComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListFooterComponentStyle?: StyleProp<ViewStyle> | undefined;
    ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null | undefined;
    ListEmptyComponentStyle?: StyleProp<ViewStyle> | undefined;
    ItemSeparatorComponent?: React.ComponentType<any>;
    viewabilityConfigCallbackPairs?: ViewabilityConfigCallbackPairs | undefined;
    viewabilityConfig?: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged | undefined;
};

export interface InternalState {
    positions: Map<string, number>;
    sizes: Map<string, number>;
    pendingAdjust: number;
    animFrameScroll: number | null;
    animFrameLayout: number | null;
    animFrameTotalSize: number | null;
    isStartReached: boolean;
    isEndReached: boolean;
    isAtBottom: boolean;
    isAtTop: boolean;
    data: any[];
    idsInFirstRender: Set<string>;
    hasScrolled: boolean;
    scrollLength: number;
    startBuffered: number;
    startNoBuffer: number;
    endBuffered: number;
    endNoBuffer: number;
    scroll: number;
    topPad: number;
    totalSize: number;
    timeouts: Set<number>;
    fixingScroll: boolean;
    nativeMarginTop: number;
    indexByKey: Map<string, number>;
    viewabilityConfigCallbackPairs: ViewabilityConfigCallbackPairs;
    renderItem: (props: LegendListRenderItemProps<any>) => ReactNode;
}

export interface ViewableRange<T> {
    startBuffered: number;
    start: number;
    endBuffered: number;
    end: number;
    items: T[];
}

export interface LegendListRenderItemProps<ItemT> {
    item: ItemT;
    index: number;
    useViewability: (configId: string, callback: ViewabilityCallback) => void;
    useViewabilityAmount: (callback: ViewabilityAmountCallback) => void;
    useRecyclingEffect: (effect: (info: LegendListRecyclingState<ItemT>) => void | (() => void)) => void;
    useRecyclingState: <T>(updateState: (info: LegendListRecyclingState<ItemT>) => T) => [T, React.Dispatch<T>];
}

export type LegendListRef = {
    /**
     * Displays the scroll indicators momentarily.
     */
    flashScrollIndicators(): void;

    getNativeScrollRef(): React.ElementRef<typeof ScrollViewComponent>;

    getScrollResponder(): ScrollResponderMixin;

    getScrollableNode(): any;

    /**
     * A helper function that scrolls to the end of the scrollview;
     * If this is a vertical ScrollView, it scrolls to the bottom.
     * If this is a horizontal ScrollView scrolls to the right.
     *
     * The options object has an animated prop, that enables the scrolling animation or not.
     * The animated prop defaults to true
     */
    scrollToEnd(options?: { animated?: boolean | undefined }): void;

    scrollToIndex: (params: { index: number; animated?: boolean; viewOffset?: number; viewPosition?: number }) => void;

    scrollToItem(params: { animated?: boolean; item: any; viewPosition?: number }): void;

    scrollToOffset(params: { offset: number; animated?: boolean }): void;
};

export interface ViewToken<ItemT = any> {
    item: ItemT;
    key: string;
    index: number;
    isViewable: boolean;
}

export interface ViewAmountToken<ItemT = any> extends ViewToken<ItemT> {
    sizeVisible: number;
    size: number;
    percentVisible: number;
    percentOfScroller: number;
    position: number;
    scrollSize: number;
}

export interface ViewabilityConfigCallbackPair {
    viewabilityConfig: ViewabilityConfig;
    onViewableItemsChanged?: OnViewableItemsChanged;
}

export type ViewabilityConfigCallbackPairs = ViewabilityConfigCallbackPair[];

export type OnViewableItemsChanged =
    | ((info: { viewableItems: Array<ViewToken>; changed: Array<ViewToken> }) => void)
    | null;

export interface ViewabilityConfig {
    /**
     * A unique ID to identify this viewability config
     */
    id: string;

    /**
     * Minimum amount of time (in milliseconds) that an item must be physically viewable before the
     * viewability callback will be fired. A high number means that scrolling through content without
     * stopping will not mark the content as viewable.
     */
    minimumViewTime?: number | undefined;

    /**
     * Percent of viewport that must be covered for a partially occluded item to count as
     * "viewable", 0-100. Fully visible items are always considered viewable. A value of 0 means
     * that a single pixel in the viewport makes the item viewable, and a value of 100 means that
     * an item must be either entirely visible or cover the entire viewport to count as viewable.
     */
    viewAreaCoveragePercentThreshold?: number | undefined;

    /**
     * Similar to `viewAreaCoveragePercentThreshold`, but considers the percent of the item that is visible,
     * rather than the fraction of the viewable area it covers.
     */
    itemVisiblePercentThreshold?: number | undefined;

    /**
     * Nothing is considered viewable until the user scrolls or `recordInteraction` is called after
     * render.
     */
    waitForInteraction?: boolean | undefined;
}

export type ViewabilityCallback = (viewToken: ViewToken) => void;
export type ViewabilityAmountCallback = (viewToken: ViewAmountToken) => void;

export interface LegendListRecyclingState<T> {
    item: T;
    prevItem: T | undefined;
    index: number;
    prevIndex: number | undefined;
}
