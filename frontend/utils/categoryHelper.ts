
// Helper to derive unique categories from products
const getUniqueCategories = (products: Product[]) => {
    const categories = new Set(products.map(p => p.category).filter(Boolean));
    return Array.from(categories).sort();
};
