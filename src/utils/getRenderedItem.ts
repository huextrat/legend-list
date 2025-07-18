import { type StateContext, peek$ } from "@/state/state";
import type { InternalState } from "@/types";
import React from "react";

export function getRenderedItem(ctx: StateContext, state: InternalState, key: string) {
    if (!state) {
        return null;
    }

    const {
        indexByKey,
        props: { data, renderItem },
    } = state;

    const index = indexByKey.get(key);

    if (index === undefined) {
        return null;
    }

    let renderedItem: React.ReactNode = null;

    if (renderItem) {
        const itemProps = {
            item: data[index],
            index,
            extraData: peek$(ctx, "extraData"),
        };

        renderedItem = React.createElement(renderItem, itemProps);
    }

    return { index, item: data[index], renderedItem };
}
