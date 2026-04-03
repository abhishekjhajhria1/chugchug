import { supabase } from "./supabase"

// Definitions of various badges and their trigger conditions
export const BADGE_DEFINITIONS: Record<string, { name: string; icon_text: string }> = {
  first_drink: { name: "First Drop", icon_text: "💧" },
  five_drinks: { name: "Thirsty", icon_text: "🍺" },
  weekend_warrior: { name: "Weekend Warrior", icon_text: "⚔️" },
  social_butterfly: { name: "Social Butterfly", icon_text: "🦋" },
  recipe_master: { name: "Recipe Master", icon_text: "👨‍🍳" },
  party_animal: { name: "Party Animal", icon_text: "🎉" },
}

export async function evaluateAndAwardBadges(userId: string) {
  try {
    // 1. Fetch user logs
    const { data: logs } = await supabase
      .from("activity_logs")
      .select("id, category, photo_metadata, created_at, item_name")
      .eq("user_id", userId)

    if (!logs) return

    // 2. Fetch already awarded badges
    const { data: awarded } = await supabase
      .from("user_badges")
      .select("badges(name)")
      .eq("user_id", userId)

    const awardedNames = new Set(awarded?.flatMap((a: any) => a.badges?.name) || [])

    // 3. Evaluate Conditions
    const toAward: string[] = []

    const drinkLogs = logs.filter(l => l.category === "drink")
    const recipeLogs = logs.filter(l => l.category === "snack" || l.photo_metadata?.is_recipe)

    if (drinkLogs.length >= 1 && !awardedNames.has(BADGE_DEFINITIONS.first_drink.name)) {
      toAward.push("first_drink")
    }
    
    if (drinkLogs.length >= 5 && !awardedNames.has(BADGE_DEFINITIONS.five_drinks.name)) {
      toAward.push("five_drinks")
    }

    if (recipeLogs.length >= 3 && !awardedNames.has(BADGE_DEFINITIONS.recipe_master.name)) {
      toAward.push("recipe_master")
    }

    // Weekend evaluation
    const weekendLogs = logs.filter(l => {
        const d = new Date(l.created_at)
        return d.getDay() === 0 || d.getDay() === 6
    })
    if (weekendLogs.length >= 5 && !awardedNames.has(BADGE_DEFINITIONS.weekend_warrior.name)) {
        toAward.push("weekend_warrior")
    }

    if (toAward.length === 0) return

    // 4. Ensure Badges exist in `badges` table, then link in `user_badges`
    for (const badgeKey of toAward) {
      const def = BADGE_DEFINITIONS[badgeKey]
      
      // Upsert badge definition globally
      const { data: badgeData } = await supabase
        .from("badges")
        .select("id")
        .eq("name", def.name)
        .single()
        
      let badgeId = badgeData?.id
      
      if (!badgeId) {
          const { data: newBadge } = await supabase
            .from("badges")
            .insert({ name: def.name, icon_text: def.icon_text, description: `Awarded for unlocking ${def.name}` })
            .select("id")
            .single()
          badgeId = newBadge?.id
      }
      
      if (badgeId) {
          await supabase.from("user_badges").insert({
              user_id: userId,
              badge_id: badgeId
          })
      }
    }

  } catch (err) {
    console.error("Error evaluating badges:", err)
  }
}
