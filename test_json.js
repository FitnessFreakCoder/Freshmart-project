try {
    const obj = { qty: 1, price: 10 };
    console.log('Testing JSON.parse on object:', obj);
    JSON.parse(obj);
} catch (e) {
    console.log('Error message:', e.message);
}
