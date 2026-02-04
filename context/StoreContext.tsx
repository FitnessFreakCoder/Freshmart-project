
import React, { createContext, useContext, useReducer, useEffect } from 'react';
import { AppState, Product, User, CartItem, Order, Coupon, UserRole } from '../types';
import { mockApi } from '../services/mockBackend';

type Action =
  | { type: 'SET_USER'; payload: User | null }
  | { type: 'UPDATE_USER_MOBILE'; payload: string }
  | { type: 'SET_PRODUCTS'; payload: Product[] }
  | { type: 'ADD_TO_CART'; payload: Product }
  | { type: 'REMOVE_FROM_CART'; payload: number }
  | { type: 'UPDATE_CART_QTY'; payload: { id: number; qty: number } }
  | { type: 'CLEAR_CART' }
  | { type: 'PLACE_ORDER'; payload: Order }
  | { type: 'SET_ORDERS'; payload: Order[] }
  | { type: 'UPDATE_ORDER_STATUS'; payload: { id: string; status: string } }
  | { type: 'SET_COUPONS'; payload: Coupon[] }
  | { type: 'ADD_COUPON'; payload: Coupon }
  | { type: 'REMOVE_COUPON'; payload: string };

const initialState: AppState = {
  user: null,
  products: [],
  cart: [],
  orders: [],
  coupons: [],
  currentOrder: null,
};

const StoreContext = createContext<{
  state: AppState;
  dispatch: React.Dispatch<Action>;
  isAdmin: boolean;
  isStaff: boolean;
}>({
  state: initialState,
  dispatch: () => null,
  isAdmin: false,
  isStaff: false,
});

const reducer = (state: AppState, action: Action): AppState => {
  switch (action.type) {
    case 'SET_USER':
      // If payload is null (Logout), clear user-specific data like cart and orders
      if (action.payload === null) {
        return { 
          ...state, 
          user: null, 
          cart: [], 
          orders: [], 
          currentOrder: null 
        };
      }
      return { ...state, user: action.payload };
    case 'UPDATE_USER_MOBILE':
      return { 
          ...state, 
          user: state.user ? { ...state.user, mobileNumber: action.payload } : null 
      };
    case 'SET_PRODUCTS':
      return { ...state, products: action.payload };
    case 'ADD_TO_CART': {
      const existing = state.cart.find(i => i.id === action.payload.id);
      if (existing) {
        return {
          ...state,
          cart: state.cart.map(i => i.id === action.payload.id ? { ...i, quantity: i.quantity + 1 } : i)
        };
      }
      return { ...state, cart: [...state.cart, { ...action.payload, quantity: 1 }] };
    }
    case 'REMOVE_FROM_CART':
      return { ...state, cart: state.cart.filter(i => i.id !== action.payload) };
    case 'UPDATE_CART_QTY': {
      // If Quantity is 0 or less, remove item from cart
      if (action.payload.qty <= 0) {
        return { ...state, cart: state.cart.filter(i => i.id !== action.payload.id) };
      }
      return {
        ...state,
        cart: state.cart.map(i => i.id === action.payload.id ? { ...i, quantity: action.payload.qty } : i)
      };
    }
    case 'CLEAR_CART':
      return { ...state, cart: [] };
    case 'PLACE_ORDER':
      return { ...state, orders: [action.payload, ...state.orders], cart: [] };
    case 'SET_ORDERS':
      return { ...state, orders: action.payload };
    case 'UPDATE_ORDER_STATUS':
      return {
        ...state,
        orders: state.orders.map(o => o.id === action.payload.id ? { ...o, status: action.payload.status as any } : o)
      };
    case 'SET_COUPONS':
      return { ...state, coupons: action.payload };
    case 'ADD_COUPON':
      return { ...state, coupons: [...state.coupons, action.payload] };
    case 'REMOVE_COUPON':
      return { ...state, coupons: state.coupons.filter(c => c.code !== action.payload) };
    default:
      return state;
  }
};

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  // Initial Load
  useEffect(() => {
    const init = async () => {
      const prods = await mockApi.getProducts();
      dispatch({ type: 'SET_PRODUCTS', payload: prods });
      
      const coupons = await mockApi.getCoupons();
      dispatch({ type: 'SET_COUPONS', payload: coupons });
    };
    init();
  }, []);

  const isAdmin = state.user?.role === UserRole.ADMIN;
  const isStaff = state.user?.role === UserRole.STAFF;

  return (
    <StoreContext.Provider value={{ state, dispatch, isAdmin, isStaff }}>
      {children}
    </StoreContext.Provider>
  );
};

export const useStore = () => useContext(StoreContext);
