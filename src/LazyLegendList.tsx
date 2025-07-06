import type { AnimatedLegendList } from "@legendapp/list/animated";
import type { AnimatedLegendList as ReanimatedLegendList } from "@legendapp/list/reanimated";
import * as React from "react";
import { type ForwardedRef, forwardRef } from "react";
import { LegendList as LegendListBase } from "./LegendList";
import { isArray } from "./helpers";
import type { LegendListProps, LegendListRef, LegendListRenderItemProps } from "./types";

// biome-ignore lint/complexity/noBannedTypes: This is a workaround for the fact that forwardRef is not typed
type TypedForwardRef = <T, P = {}>(
    render: (props: P, ref: React.Ref<T>) => React.ReactNode,
) => (props: P & React.RefAttributes<T>) => React.ReactNode;

const typedForwardRef = forwardRef as TypedForwardRef;

export interface LazyLegendListProps<ItemT, ListT>
    extends Omit<LegendListProps<ItemT>, "data" | "keyExtractor" | "renderItem"> {
    children?: React.ReactNode | undefined;
    LegendList?: ListT;
}

const renderItem = ({ item }: LegendListRenderItemProps<any>) => item;

export const LazyLegendList = typedForwardRef(function LazyLegendList<
    ItemT,
    ListT extends
        | typeof LegendListBase
        | typeof AnimatedLegendList
        | typeof ReanimatedLegendList = typeof LegendListBase,
>(props: LazyLegendListProps<ItemT, ListT>, forwardedRef: ForwardedRef<LegendListRef>) {
    const { LegendList: LegendListProp, children, ...rest } = props;

    const LegendListComponent = LegendListProp ?? LegendListBase;

    const data = (isArray(children) ? children : React.Children.toArray(children)).flat(1);

    return (
        // @ts-expect-error TODO: Fix this type
        <LegendListComponent {...rest} data={data} renderItem={renderItem} ref={forwardedRef} />
    );
});
