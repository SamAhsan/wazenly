"use client";

import { createContext, useContext, useState, ReactNode } from "react";

interface WhatsAppNumber {
  id: string;
  displayName: string;
  phoneNumber: string;
  status: string;
}

interface NumberContextType {
  selectedNumberId: string | null;
  setSelectedNumberId: (id: string | null) => void;
  numbers: WhatsAppNumber[];
  setNumbers: (numbers: WhatsAppNumber[]) => void;
  selectedNumber: WhatsAppNumber | null;
}

const NumberContext = createContext<NumberContextType>({
  selectedNumberId: null,
  setSelectedNumberId: () => {},
  numbers: [],
  setNumbers: () => {},
  selectedNumber: null,
});

export function NumberProvider({ children }: { children: ReactNode }) {
  const [selectedNumberId, setSelectedNumberIdState] = useState<string | null>(() => {
    if (typeof window === "undefined") return null;
    return localStorage.getItem("wazenly_selectedNumberId");
  });
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);

  const setSelectedNumberId = (id: string | null) => {
    setSelectedNumberIdState(id);
    if (id) localStorage.setItem("wazenly_selectedNumberId", id);
    else localStorage.removeItem("wazenly_selectedNumberId");
  };

  const connectedNumbers = numbers.filter((n) => n.status === "CONNECTED");
  const selectedNumber =
    connectedNumbers.find((n) => n.id === selectedNumberId) ||
    connectedNumbers[0] ||
    null;

  return (
    <NumberContext.Provider value={{ selectedNumberId: selectedNumber?.id || null, setSelectedNumberId, numbers, setNumbers, selectedNumber }}>
      {children}
    </NumberContext.Provider>
  );
}

export function useSelectedNumber() {
  return useContext(NumberContext);
}
