import React, { useState, useMemo } from "react";
import { Card as CardType } from "../game/config";
import decksData from "../game/decks.json";

// 卡牌视图组件 - 与游戏中一致
const CardView: React.FC<{ card: CardType }> = ({ card }) => {
  const isSnack = card.type === "Snack";

  const renderAttributes = (c: CardType) => {
    const isC_Snack = c.type === "Snack";
    const { colors, shapes, temps } = c.attributes;

    const allColors = ["red", "green", "yellow"];
    const allShapes = ["circle", "square", "flower"];
    const allTemps = ["warm", "cold"];

    const renderSlot = (type: "color" | "shape" | "temp", value: string, isActive: boolean) => {
      const sizeClass = isC_Snack ? "w-3 h-3" : "w-5 h-5";
      let colorClass = "";
      let shapeStyle = "rounded-full";

      if (isActive) {
        if (type === "color") {
          if (value === "red") colorClass = isC_Snack ? "bg-rose-500" : "border-rose-500 border-2";
          else if (value === "green")
            colorClass = isC_Snack ? "bg-emerald-500" : "border-emerald-500 border-2";
          else if (value === "yellow")
            colorClass = isC_Snack ? "bg-amber-400" : "border-amber-400 border-2";
        } else if (type === "shape") {
          colorClass = isC_Snack ? "bg-slate-600" : "border-slate-600 border-2";
          if (value === "square") shapeStyle = "rounded-md";
          else if (value === "flower") shapeStyle = "rotate-45 rounded-sm";
        } else if (type === "temp") {
          if (value === "warm") {
            colorClass = isC_Snack ? "bg-orange-500" : "border-orange-500 border-2";
            shapeStyle = "rounded-t-lg";
          } else {
            colorClass = isC_Snack ? "bg-cyan-500" : "border-cyan-500 border-2";
            shapeStyle = "rounded-b-lg";
          }
        }
      }

      return (
        <div key={`${type}-${value}`} className="flex items-center justify-center w-6 h-6">
          {isActive ? (
            <div
              className={`${sizeClass} ${colorClass} ${shapeStyle} shadow-sm transform transition-all`}
            />
          ) : (
            <div className="w-1 h-1" />
          )}
        </div>
      );
    };

    return (
      <div className="absolute inset-0 flex flex-col justify-evenly py-2 pointer-events-none">
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allColors.map((val) => renderSlot("color", val, colors.includes(val as any)))}
        </div>
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allShapes.map((val) => renderSlot("shape", val, shapes.includes(val as any)))}
        </div>
        <div className="flex justify-center items-center h-8 w-full gap-1">
          {allTemps.map((val) => renderSlot("temp", val, temps.includes(val as any)))}
        </div>
      </div>
    );
  };

  return (
    <div
      className={`
        relative w-24 h-36 rounded-lg border shadow-sm m-1 transition-transform hover:scale-110
        ${isSnack ? "bg-pink-50/80 border-pink-200" : "bg-stone-50/80 border-stone-300"}
        flex flex-col items-center select-none overflow-hidden cursor-pointer
      `}
    >
      {!isSnack && (
        <div
          className={`absolute top-0 right-0 px-1.5 py-0.5 text-[8px] font-bold text-white rounded-bl-lg
            ${
              card.level === 1
                ? "bg-gray-400"
                : card.level === 2
                  ? "bg-blue-400"
                  : card.level === 3
                    ? "bg-purple-500"
                    : "bg-amber-500"
            }
         `}
        >
          L{card.level}
        </div>
      )}

      <div className="text-[10px] font-bold mt-2 text-gray-700 truncate w-full text-center px-1 z-10 font-serif">
        {card.name}
      </div>

      <div className="flex-grow w-full relative">{renderAttributes(card)}</div>

      <div className="text-[9px] text-gray-400 mb-1 z-10 w-full text-center border-t border-gray-100 pt-1">
        {isSnack ? "点心" : card.description || "食器"}
      </div>
    </div>
  );
};

// 主卡牌画廊组件
const CardGallery: React.FC = () => {
  const [selectedType, setSelectedType] = useState<"all" | "Snack" | "Tableware">("all");
  const [selectedColors, setSelectedColors] = useState<Set<string>>(new Set());
  const [selectedShapes, setSelectedShapes] = useState<Set<string>>(new Set());
  const [selectedTemps, setSelectedTemps] = useState<Set<string>>(new Set());
  const [selectedLevel, setSelectedLevel] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"name" | "level" | "type">("type");

  // 从 decks.json 加载所有卡牌
  const allCards: CardType[] = useMemo(() => {
    const snackCards = (decksData.snackDeck || []) as CardType[];
    const tablewareCards = (decksData.tablewareDeck || []) as CardType[];
    return [...snackCards, ...tablewareCards];
  }, []);

  // 筛选卡牌
  const filteredCards = useMemo(() => {
    let cards = allCards;

    // 按类型筛选
    if (selectedType !== "all") {
      cards = cards.filter((card) => card.type === selectedType);
    }

    // 按颜色筛选
    if (selectedColors.size > 0) {
      cards = cards.filter((card) =>
        card.attributes.colors.some((color) => selectedColors.has(color))
      );
    }

    // 按形状筛选
    if (selectedShapes.size > 0) {
      cards = cards.filter((card) =>
        card.attributes.shapes.some((shape) => selectedShapes.has(shape))
      );
    }

    // 按温度筛选
    if (selectedTemps.size > 0) {
      cards = cards.filter((card) =>
        card.attributes.temps.some((temp) => selectedTemps.has(temp))
      );
    }

    // 按等级筛选
    if (selectedLevel !== null) {
      cards = cards.filter((card) => card.level === selectedLevel);
    }

    // 排序
    cards = [...cards].sort((a, b) => {
      if (sortBy === "name") return a.name.localeCompare(b.name);
      if (sortBy === "level") return b.level - a.level;
      if (sortBy === "type") {
        if (a.type !== b.type) return a.type === "Snack" ? -1 : 1;
        return a.level - b.level;
      }
      return 0;
    });

    return cards;
  }, [allCards, selectedType, selectedColors, selectedShapes, selectedTemps, selectedLevel, sortBy]);

  // 切换筛选器
  const toggleFilter = (filterSet: Set<string>, value: string) => {
    const newSet = new Set(filterSet);
    if (newSet.has(value)) {
      newSet.delete(value);
    } else {
      newSet.add(value);
    }
    return newSet;
  };

  // 统计信息
  const stats = useMemo(() => {
    return {
      total: allCards.length,
      snacks: allCards.filter((c) => c.type === "Snack").length,
      tableware: allCards.filter((c) => c.type === "Tableware").length,
      filtered: filteredCards.length,
    };
  }, [allCards, filteredCards]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-amber-50 via-pink-50 to-purple-50 p-8">
      <div className="max-w-7xl mx-auto">
        {/* 标题 */}
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-800 mb-2 font-serif">卡牌图鉴</h1>
          <p className="text-gray-600">
            共 {stats.total} 张卡牌 (点心: {stats.snacks} | 食器: {stats.tableware})
          </p>
          <p className="text-sm text-gray-500">当前显示: {stats.filtered} 张</p>
        </div>

        {/* 筛选面板 */}
        <div className="bg-white/80 backdrop-blur-sm rounded-xl shadow-lg p-6 mb-8 border border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* 卡牌类型 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">卡牌类型</label>
              <div className="flex gap-2 flex-wrap">
                {["all", "Snack", "Tableware"].map((type) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedType === type
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {type === "all" ? "全部" : type === "Snack" ? "点心" : "食器"}
                  </button>
                ))}
              </div>
            </div>

            {/* 颜色 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">颜色</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "red", label: "红", color: "bg-rose-500" },
                  { value: "green", label: "绿", color: "bg-emerald-500" },
                  { value: "yellow", label: "黄", color: "bg-amber-400" },
                ].map((color) => (
                  <button
                    key={color.value}
                    onClick={() => setSelectedColors(toggleFilter(selectedColors, color.value))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedColors.has(color.value)
                        ? `${color.color} text-white shadow-md`
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {color.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 形状 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">形状</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "circle", label: "圆形" },
                  { value: "square", label: "方形" },
                  { value: "flower", label: "花形" },
                ].map((shape) => (
                  <button
                    key={shape.value}
                    onClick={() => setSelectedShapes(toggleFilter(selectedShapes, shape.value))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedShapes.has(shape.value)
                        ? "bg-slate-600 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {shape.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 温度 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">温度</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "warm", label: "热", color: "bg-orange-500" },
                  { value: "cold", label: "冷", color: "bg-cyan-500" },
                ].map((temp) => (
                  <button
                    key={temp.value}
                    onClick={() => setSelectedTemps(toggleFilter(selectedTemps, temp.value))}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedTemps.has(temp.value)
                        ? `${temp.color} text-white shadow-md`
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {temp.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 等级 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">等级</label>
              <div className="flex gap-2 flex-wrap">
                {[null, 1, 2, 3].map((level) => (
                  <button
                    key={level ?? "all"}
                    onClick={() => setSelectedLevel(level)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      selectedLevel === level
                        ? "bg-purple-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {level === null ? "全部" : `L${level}`}
                  </button>
                ))}
              </div>
            </div>

            {/* 排序 */}
            <div>
              <label className="block text-sm font-bold text-gray-700 mb-2">排序</label>
              <div className="flex gap-2 flex-wrap">
                {[
                  { value: "type", label: "类型" },
                  { value: "name", label: "名称" },
                  { value: "level", label: "等级" },
                ].map((sort) => (
                  <button
                    key={sort.value}
                    onClick={() => setSortBy(sort.value as any)}
                    className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                      sortBy === sort.value
                        ? "bg-indigo-500 text-white shadow-md"
                        : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                    }`}
                  >
                    {sort.label}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* 清除筛选 */}
          <div className="mt-4 text-center">
            <button
              onClick={() => {
                setSelectedType("all");
                setSelectedColors(new Set());
                setSelectedShapes(new Set());
                setSelectedTemps(new Set());
                setSelectedLevel(null);
              }}
              className="px-6 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-all text-sm font-medium"
            >
              清除所有筛选
            </button>
          </div>
        </div>

        {/* 卡牌网格 */}
        <div className="flex flex-wrap justify-center gap-2">
          {filteredCards.map((card) => (
            <CardView key={card.id} card={card} />
          ))}
        </div>

        {filteredCards.length === 0 && (
          <div className="text-center text-gray-500 py-12">
            <p className="text-xl">没有找到匹配的卡牌</p>
            <p className="text-sm mt-2">请调整筛选条件</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default CardGallery;
