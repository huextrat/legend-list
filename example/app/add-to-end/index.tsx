import { useState } from "react";
import { Button, SafeAreaView, StyleSheet, Text, View } from "react-native";

import { LegendList } from "@legendapp/list";

const ListComponent = () => {
    const [items, setItems] = useState<{ id: string; title: string }[]>([]);
    const [counter, setCounter] = useState(0);

    const addSixtyItems = () => {
        const newItems = [];
        const startIndex = counter;

        for (let i = 0; i < 60; i++) {
            newItems.push({
                id: `item-${startIndex + i}`,

                title: `Item ${startIndex + i}`,
            });
        }

        setItems([...items, ...newItems]);
        setCounter((prev) => prev + 60);
    };

    const renderItem = ({ item }: { item: { id: string; title: string } }) => (
        <View style={styles.itemContainer}>
            <Text style={styles.itemText}>{item.title}</Text>
        </View>
    );

    return (
        <SafeAreaView style={styles.safeArea}>
            <View style={styles.container}>
                <Button title="Add 60 Items" onPress={addSixtyItems} color="#4285F4" />

                <LegendList
                    data={items}
                    renderItem={renderItem}
                    keyExtractor={(item) => item.id}
                    style={styles.list}
                    contentContainerStyle={styles.listContent}
                    maintainScrollAtEnd
                />
            </View>
        </SafeAreaView>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
        backgroundColor: "#f5f5f5",
    },
    container: {
        flex: 1,
        padding: 16,
        backgroundColor: "#f5f5f5",
    },
    list: {
        flex: 1,
        marginTop: 16,
    },
    listContent: {
        paddingBottom: 16,
    },
    itemContainer: {
        backgroundColor: "white",
        padding: 16,
        marginVertical: 8,
        borderRadius: 8,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.2,
        shadowRadius: 1,
        elevation: 2,
    },
    itemText: {
        fontSize: 16,
    },
});

export default ListComponent;
