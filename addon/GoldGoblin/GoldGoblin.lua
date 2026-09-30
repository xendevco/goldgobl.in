--[[
GoldGoblin exports an account-wide GG1 string for goldgobl.in.

In-game check:
1. Log a character, run /gg, and copy the string.
2. Log a second character on the same account and run /gg again.
3. Both names should be inside the decoded roster after you paste it on the site.
]]

local ADDON = "GoldGoblin"

local EQUIPMENT_SLOTS = {
  { id = 20, slot = "Profession 1 Tool", professionIndex = 1 },
  { id = 21, slot = "Profession 1 Accessory", professionIndex = 1 },
  { id = 22, slot = "Profession 1 Accessory 2", professionIndex = 1 },
  { id = 23, slot = "Profession 2 Tool", professionIndex = 2 },
  { id = 24, slot = "Profession 2 Accessory", professionIndex = 2 },
  { id = 25, slot = "Profession 2 Accessory 2", professionIndex = 2 },
}

local BASE64 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

local function database()
  if type(GoldGoblinDB) ~= "table" then
    GoldGoblinDB = { characters = {} }
  end
  if type(GoldGoblinDB.characters) ~= "table" then
    GoldGoblinDB.characters = {}
  end
  return GoldGoblinDB
end

local function jsonEscape(value)
  return '"' .. tostring(value):gsub('[%z\1-\31\\"]', function(char)
    if char == '"' then return '\\"' end
    if char == "\\" then return "\\\\" end
    if char == "\n" then return "\\n" end
    if char == "\r" then return "\\r" end
    if char == "\t" then return "\\t" end
    return string.format("\\u%04x", string.byte(char))
  end) .. '"'
end

local function isArray(value)
  local count = 0
  for key in pairs(value) do
    if type(key) ~= "number" then return false end
    count = count + 1
  end
  return count == #value
end

-- An empty Lua table has no keys, so isArray treats it as []. knowledge must stay {}.
local OBJECT_KEYS = { knowledge = true }

local function encodeJson(value, key)
  local kind = type(value)
  if kind == "string" then return jsonEscape(value) end
  if kind == "number" then
    if value ~= value or value == math.huge or value == -math.huge then return "0" end
    return tostring(math.floor(value))
  end
  if kind ~= "table" then return "null" end
  if not OBJECT_KEYS[key] and isArray(value) then
    local parts = {}
    for index = 1, #value do
      parts[index] = encodeJson(value[index])
    end
    return "[" .. table.concat(parts, ",") .. "]"
  end
  local parts = {}
  for entryKey, entry in pairs(value) do
    parts[#parts + 1] = jsonEscape(entryKey) .. ":" .. encodeJson(entry, entryKey)
  end
  table.sort(parts)
  return "{" .. table.concat(parts, ",") .. "}"
end

local function base64Encode(raw)
  local output = {}
  local length = #raw
  local index = 1
  while index <= length do
    local a = string.byte(raw, index) or 0
    local b = string.byte(raw, index + 1)
    local c = string.byte(raw, index + 2)
    local triple = a * 65536 + (b or 0) * 256 + (c or 0)
    output[#output + 1] = BASE64:sub(math.floor(triple / 262144) % 64 + 1, math.floor(triple / 262144) % 64 + 1)
    output[#output + 1] = BASE64:sub(math.floor(triple / 4096) % 64 + 1, math.floor(triple / 4096) % 64 + 1)
    output[#output + 1] = b and BASE64:sub(math.floor(triple / 64) % 64 + 1, math.floor(triple / 64) % 64 + 1) or "="
    output[#output + 1] = c and BASE64:sub(triple % 64 + 1, triple % 64 + 1) or "="
    index = index + 3
  end
  return table.concat(output)
end

local function libDeflate()
  if type(LibDeflate) == "table" and type(LibDeflate.CompressDeflate) == "function" then
    return LibDeflate
  end
  if type(LibStub) == "table" and type(LibStub.GetLibrary) == "function" then
    local ok, lib = pcall(LibStub.GetLibrary, LibStub, "LibDeflate", true)
    if ok and type(lib) == "table" and type(lib.CompressDeflate) == "function" then
      return lib
    end
  end
end

local function encodeExport(payload)
  local lib = libDeflate()
  if not lib then
    return nil, "LibDeflate is not loaded."
  end
  local ok, compressed = pcall(function()
    return lib:CompressDeflate(encodeJson(payload))
  end)
  if not ok then
    return nil, tostring(compressed)
  end
  if type(compressed) ~= "string" then
    return nil, "LibDeflate returned no data."
  end
  return "GG1:" .. base64Encode(compressed)
end

local function readKnowledge(skillLine)
  local knowledge = {}
  if not skillLine or type(C_ProfSpecs) ~= "table" or type(C_Traits) ~= "table" then
    return knowledge
  end
  if type(C_ProfSpecs.GetConfigIDForSkillLine) ~= "function" then return knowledge end
  local ok, configID = pcall(C_ProfSpecs.GetConfigIDForSkillLine, skillLine)
  if not ok or not configID or type(C_Traits.GetConfigInfo) ~= "function" then return knowledge end
  local infoOk, configInfo = pcall(C_Traits.GetConfigInfo, configID)
  if not infoOk or type(configInfo) ~= "table" or type(configInfo.treeIDs) ~= "table" then return knowledge end
  for _, treeID in ipairs(configInfo.treeIDs) do
    if type(C_Traits.GetTreeNodes) == "function" then
      local nodesOk, nodes = pcall(C_Traits.GetTreeNodes, treeID)
      if nodesOk and type(nodes) == "table" then
        for _, nodeID in ipairs(nodes) do
          local nodeOk, node = pcall(C_Traits.GetNodeInfo, configID, nodeID)
          if nodeOk and type(node) == "table" and type(node.ranksPurchased) == "number" and node.ranksPurchased > 0 then
            knowledge[tostring(nodeID)] = math.floor(node.ranksPurchased)
          end
        end
      end
    end
  end
  return knowledge
end

local function itemName(itemID)
  if itemID and C_Item and type(C_Item.GetItemNameByID) == "function" then
    local ok, name = pcall(C_Item.GetItemNameByID, itemID)
    if ok and type(name) == "string" and name ~= "" then return name end
  end
  return itemID and ("Item " .. itemID) or ""
end

local function readEquipment(professionIndex)
  local equipment = {}
  for _, slot in ipairs(EQUIPMENT_SLOTS) do
    if slot.professionIndex == professionIndex then
      local itemID = GetInventoryItemID("player", slot.id)
      if itemID then
        equipment[#equipment + 1] = { slot = slot.slot, itemId = itemID, name = itemName(itemID) }
      end
    end
  end
  return equipment
end

local function upsertProfession(character, profession)
  for _, existing in ipairs(character.professions) do
    if existing.id == profession.id or (profession.name ~= "" and existing.name == profession.name) then
      existing.skill = profession.skill
      existing.maxSkill = profession.maxSkill
      if next(profession.knowledge) then existing.knowledge = profession.knowledge end
      if #profession.equipment > 0 then existing.equipment = profession.equipment end
      if #profession.recipes > 0 then existing.recipes = profession.recipes end
      return
    end
  end
  character.professions[#character.professions + 1] = profession
end

local function scanSkillLines()
  local character = database().characters[GoldGoblin_CharacterKey()]
  if not character or type(GetProfessions) ~= "function" or type(GetProfessionInfo) ~= "function" then return end
  local ok, first, second = pcall(GetProfessions)
  if not ok then return end
  local indexes = { first, second }
  for professionIndex, index in ipairs(indexes) do
    if index then
      local infoOk, name, _, skillLevel, maxSkillLevel, _, _, skillLine = pcall(GetProfessionInfo, index)
      if infoOk and type(name) == "string" then
        upsertProfession(character, {
          id = skillLine or 0,
          name = name,
          skill = skillLevel or 0,
          maxSkill = maxSkillLevel or 0,
          knowledge = readKnowledge(skillLine),
          equipment = readEquipment(professionIndex),
          recipes = {},
        })
      end
    end
  end
end

local function itemName(itemID)
  if type(C_Item) == "table" and type(C_Item.GetItemNameByID) == "function" then
    local ok, name = pcall(C_Item.GetItemNameByID, itemID)
    if ok and type(name) == "string" and name ~= "" then return name end
  end
  if type(GetItemInfo) == "function" then
    local name = GetItemInfo(itemID)
    if type(name) == "string" and name ~= "" then return name end
  end
  return "Item " .. tostring(itemID)
end

local function readSchematic(recipeID)
  if type(C_TradeSkillUI.GetRecipeSchematic) ~= "function" then return nil end
  local ok, schematic = pcall(C_TradeSkillUI.GetRecipeSchematic, recipeID, false)
  if not ok or type(schematic) ~= "table" then return nil end
  local itemID = schematic.outputItemID
  if type(itemID) ~= "number" or itemID <= 0 then
    if type(C_TradeSkillUI.GetRecipeOutputItemData) == "function" then
      local outOk, output = pcall(C_TradeSkillUI.GetRecipeOutputItemData, recipeID)
      if outOk and type(output) == "table" then itemID = output.itemID end
    end
  end
  if type(itemID) ~= "number" or itemID <= 0 then return nil end
  local quantity = schematic.quantityMin or schematic.quantityMax or 1
  if type(quantity) ~= "number" or quantity < 1 then quantity = 1 end
  local reagents = {}
  if type(schematic.reagentSlotSchematics) == "table" then
    for _, slot in ipairs(schematic.reagentSlotSchematics) do
      if type(slot) == "table" and slot.required ~= false then
        local options = {}
        if type(slot.reagents) == "table" then
          for _, reagent in ipairs(slot.reagents) do
            local reagentID = type(reagent) == "table" and reagent.itemID or nil
            if type(reagentID) == "number" and reagentID > 0 then
              options[#options + 1] = { itemId = reagentID, name = itemName(reagentID) }
            end
          end
        end
        local needed = slot.quantityRequired or 1
        if #options > 0 and type(needed) == "number" and needed > 0 then
          reagents[#reagents + 1] = { quantity = math.floor(needed), options = options }
        end
      end
    end
  end
  if #reagents == 0 then return nil end
  return { itemId = itemID, quantity = math.floor(quantity), reagents = reagents }
end

local function scanOpenProfession()
  if type(C_TradeSkillUI) ~= "table" or type(C_TradeSkillUI.GetBaseProfessionInfo) ~= "function" then return end
  local character = database().characters[GoldGoblin_CharacterKey()]
  if not character then return end
  local ok, base = pcall(C_TradeSkillUI.GetBaseProfessionInfo)
  if not ok or type(base) ~= "table" then return end
  local recipes = {}
  if type(C_TradeSkillUI.GetAllRecipeIDs) == "function" then
    local idsOk, ids = pcall(C_TradeSkillUI.GetAllRecipeIDs)
    if idsOk and type(ids) == "table" then
      for _, recipeID in ipairs(ids) do
        local info
        if type(C_TradeSkillUI.GetRecipeInfo) == "function" then
          local infoOk, recipeInfo = pcall(C_TradeSkillUI.GetRecipeInfo, recipeID)
          if infoOk then info = recipeInfo end
        end
        local name = type(info) == "table" and type(info.name) == "string" and info.name or ""
        local learned = type(info) ~= "table" or info.learned ~= false
        local recraft = type(info) == "table" and (info.isRecraft or name:find("^Recraft") == 1)
        if learned and not recraft then
          local recipe = { id = recipeID, name = name }
          local schematic = readSchematic(recipeID)
          if schematic then
            recipe.itemId = schematic.itemId
            recipe.quantity = schematic.quantity
            recipe.reagents = schematic.reagents
          end
          recipes[#recipes + 1] = recipe
        end
      end
    end
  end
  upsertProfession(character, {
    id = base.professionID or 0,
    name = base.professionName or "",
    skill = base.skillLevel or 0,
    maxSkill = base.maxSkillLevel or 0,
    knowledge = readKnowledge(base.professionID),
    equipment = {},
    recipes = recipes,
  })
end

function GoldGoblin_CharacterKey()
  local name, realm = UnitFullName("player")
  realm = realm and realm ~= "" and realm or GetRealmName()
  return (name or "Unknown") .. "-" .. (realm or "Unknown")
end

local function captureCharacter()
  local name, realm = UnitFullName("player")
  realm = realm and realm ~= "" and realm or GetRealmName()
  local _, classToken = UnitClass("player")
  local _, raceToken = UnitRace("player")
  local faction = UnitFactionGroup("player")
  local key = GoldGoblin_CharacterKey()
  local store = database()
  local existing = store.characters[key] or emptyCharacter()
  existing.name = name or existing.name or "Unknown"
  existing.realm = realm or existing.realm or "Unknown"
  existing.class = classToken or existing.class or ""
  existing.race = raceToken or existing.race or ""
  existing.faction = faction or existing.faction or ""
  if type(existing.professions) ~= "table" then existing.professions = {} end
  store.characters[key] = existing
  scanSkillLines()
end

function emptyCharacter()
  return { name = "", realm = "", class = "", race = "", faction = "", professions = {} }
end

local function buildPayload()
  local characters = {}
  for _, character in pairs(database().characters) do
    characters[#characters + 1] = character
  end
  table.sort(characters, function(left, right)
    return (left.name or "") < (right.name or "")
  end)
  return { v = 1, exportedAt = time(), characters = characters }
end

local exportFrame
local exportBox

local function ensureFrame()
  if exportFrame then return end
  local frame = CreateFrame("Frame", "GoldGoblinExportFrame", UIParent, "BackdropTemplate")
  frame:SetSize(560, 440)
  frame:SetPoint("CENTER")
  frame:SetFrameStrata("DIALOG")
  frame:SetBackdrop({
    bgFile = "Interface\\DialogFrame\\UI-DialogBox-Background",
    edgeFile = "Interface\\DialogFrame\\UI-DialogBox-Border",
    tile = true,
    tileSize = 32,
    edgeSize = 32,
    insets = { left = 11, right = 12, top = 12, bottom = 11 },
  })
  frame:EnableMouse(true)
  frame:SetMovable(true)
  frame:RegisterForDrag("LeftButton")
  frame:SetScript("OnDragStart", frame.StartMoving)
  frame:SetScript("OnDragStop", frame.StopMovingOrSizing)
  frame:Hide()

  local title = frame:CreateFontString(nil, "ARTWORK", "GameFontNormalLarge")
  title:SetPoint("TOP", 0, -16)
  title:SetText("GoldGoblin export")

  local hint = frame:CreateFontString(nil, "ARTWORK", "GameFontHighlightSmall")
  hint:SetPoint("TOPLEFT", 20, -42)
  hint:SetPoint("TOPRIGHT", -20, -42)
  hint:SetJustifyH("LEFT")
  hint:SetText("Open each profession first, then click Copy and press Ctrl+C. Logging another character adds them to the same export.")

  local scroll = CreateFrame("ScrollFrame", nil, frame, "UIPanelScrollFrameTemplate")
  scroll:SetPoint("TOPLEFT", 20, -72)
  scroll:SetPoint("BOTTOMRIGHT", -36, 46)

  local edit = CreateFrame("EditBox", nil, scroll)
  edit:SetMultiLine(true)
  edit:SetFontObject(ChatFontNormal)
  edit:SetWidth(490)
  edit:SetAutoFocus(false)
  edit:SetMaxLetters(400000)
  edit:SetScript("OnEscapePressed", function() frame:Hide() end)
  edit:SetScript("OnTextChanged", function(self, userInput)
    if not userInput then return end
    self:SetText(self.goldgoblinText or "")
    self:HighlightText()
  end)
  edit:SetScript("OnMouseUp", function(self)
    self:HighlightText()
  end)
  scroll:SetScrollChild(edit)

  local function selectExport()
    edit:SetFocus()
    edit:HighlightText()
    hint:SetText("The export is selected. Press Ctrl+C, then paste it into goldgobl.in.")
  end

  local copy = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
  copy:SetSize(120, 22)
  copy:SetPoint("BOTTOMLEFT", 20, 14)
  copy:SetText("Copy")
  copy:SetScript("OnClick", selectExport)

  local close = CreateFrame("Button", nil, frame, "UIPanelButtonTemplate")
  close:SetSize(80, 22)
  close:SetPoint("BOTTOMRIGHT", -20, 14)
  close:SetText("Close")
  close:SetScript("OnClick", function() frame:Hide() end)

  frame.hint = hint
  frame.selectExport = selectExport
  exportFrame = frame
  exportBox = edit
end

function GoldGoblin_ShowExport()
  ensureFrame()
  captureCharacter()
  local encoded, err = encodeExport(buildPayload())
  exportBox.goldgoblinText = encoded or ("LibDeflate could not compress this export. " .. (err or ""))
  exportBox:SetText(exportBox.goldgoblinText)
  exportFrame:Show()
  exportFrame.selectExport()
  C_Timer.After(0, function()
    if exportFrame:IsShown() then exportFrame.selectExport() end
  end)
end

local events = CreateFrame("Frame")
events:RegisterEvent("ADDON_LOADED")
events:RegisterEvent("PLAYER_LOGIN")
events:RegisterEvent("TRADE_SKILL_SHOW")
events:RegisterEvent("SKILL_LINES_CHANGED")
events:SetScript("OnEvent", function(_, event, arg1)
  if event == "ADDON_LOADED" and arg1 == ADDON then
    database()
    return
  end
  if event == "PLAYER_LOGIN" or event == "SKILL_LINES_CHANGED" then
    local ok = pcall(captureCharacter)
    if not ok then database() end
    return
  end
  if event == "TRADE_SKILL_SHOW" then
    pcall(captureCharacter)
    pcall(scanOpenProfession)
  end
end)

SLASH_GOLDGOBLIN1 = "/gg"
SLASH_GOLDGOBLIN2 = "/goldgoblin"
SlashCmdList.GOLDGOBLIN = function()
  GoldGoblin_ShowExport()
end
