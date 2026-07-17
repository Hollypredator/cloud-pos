from pathlib import Path

def main():
    content = Path('src/lib/data.ts').read_text(encoding='utf-8')
    
    symbols = [
        "demoCategories", "demoProducts", "demoSelfServiceCategories", 
        "demoSelfServiceProducts", "demoTables", "demoOrders", 
        "demoIngredients", "demoProductIngredients", "demoModifierGroups", 
        "demoModifierOptions", "demoBusiness", "demoBranches", 
        "demoCouriers", "getDemoMenuSeed", "helperEnrichCalories"
    ]
    
    for sym in symbols:
        # Find occurrences, counting how many times they appear in the file
        count = content.count(sym)
        print(f"Symbol '{sym}': occurs {count} times")

if __name__ == '__main__':
    main()
