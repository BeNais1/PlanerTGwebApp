import SwiftUI

struct SubscriptionPreset: Identifiable, Hashable {
    let id: String
    let name: String
    let icon: String
    let colorHex: UInt
    let suggestedAmount: Double
    let suggestedCurrency: CurrencyCode
    let categoryId: String

    var color: Color { Color(hex: colorHex) }
}

let subscriptionPresets: [SubscriptionPreset] = [
    .init(id: "netflix", name: "Netflix", icon: "play.tv.fill", colorHex: 0xE50914, suggestedAmount: 12.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "spotify", name: "Spotify", icon: "music.note", colorHex: 0x1DB954, suggestedAmount: 9.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "youtube", name: "YouTube Premium", icon: "play.rectangle.fill", colorHex: 0xFF0000, suggestedAmount: 11.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "appletv", name: "Apple TV+", icon: "appletv.fill", colorHex: 0x000000, suggestedAmount: 9.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "icloud", name: "iCloud+", icon: "icloud.fill", colorHex: 0x0EA5E9, suggestedAmount: 2.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "chatgpt", name: "ChatGPT Plus", icon: "brain", colorHex: 0x10A37F, suggestedAmount: 20.00, suggestedCurrency: .usd, categoryId: "subscriptions"),
    .init(id: "claude", name: "Claude Pro", icon: "sparkles", colorHex: 0xD97706, suggestedAmount: 20.00, suggestedCurrency: .usd, categoryId: "subscriptions"),
    .init(id: "github", name: "GitHub Copilot", icon: "chevron.left.forwardslash.chevron.right", colorHex: 0x24292F, suggestedAmount: 10.00, suggestedCurrency: .usd, categoryId: "subscriptions"),
    .init(id: "notion", name: "Notion", icon: "doc.text.fill", colorHex: 0x000000, suggestedAmount: 8.00, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "figma", name: "Figma", icon: "rectangle.3.group.fill", colorHex: 0xF24E1E, suggestedAmount: 15.00, suggestedCurrency: .usd, categoryId: "subscriptions"),
    .init(id: "telegram", name: "Telegram Premium", icon: "paperplane.fill", colorHex: 0x0088CC, suggestedAmount: 4.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "discord", name: "Discord Nitro", icon: "bubble.left.and.bubble.right.fill", colorHex: 0x5865F2, suggestedAmount: 9.99, suggestedCurrency: .eur, categoryId: "subscriptions"),
    .init(id: "gym", name: "Спортзал", icon: "figure.run", colorHex: 0xF59E0B, suggestedAmount: 30.00, suggestedCurrency: .eur, categoryId: "health"),
    .init(id: "internet", name: "Інтернет", icon: "wifi", colorHex: 0x06B6D4, suggestedAmount: 200, suggestedCurrency: .uah, categoryId: "home"),
    .init(id: "mobile", name: "Мобільний зв'язок", icon: "antenna.radiowaves.left.and.right", colorHex: 0x10B981, suggestedAmount: 150, suggestedCurrency: .uah, categoryId: "home"),
    .init(id: "custom", name: "Інше", icon: "plus.circle.fill", colorHex: 0x64748B, suggestedAmount: 0, suggestedCurrency: .eur, categoryId: "other")
]
