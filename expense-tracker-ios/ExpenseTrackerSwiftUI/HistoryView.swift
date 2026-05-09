import SwiftUI

struct HistoryView: View {
    @EnvironmentObject private var store: AppStore

    var body: some View {
        ZStack {
            AppBackground()
            ScrollView {
                VStack(alignment: .leading, spacing: 18) {
                    Text("История")
                        .font(.largeTitle.weight(.bold))
                        .foregroundStyle(.white)
                        .frame(maxWidth: .infinity, alignment: .leading)

                    ForEach(store.groupedHistory, id: \.0) { section in
                        VStack(alignment: .leading, spacing: 10) {
                            Text(section.0)
                                .font(.subheadline.weight(.semibold))
                                .foregroundStyle(.white.opacity(0.68))

                            ForEach(section.1) { item in
                                TransactionRow(item: item)
                                    .contextMenu {
                                        Button(role: .destructive) {
                                            store.deleteTransaction(item)
                                        } label: {
                                            Label("Удалить", systemImage: "trash")
                                        }
                                    }
                            }
                        }
                    }
                }
                .padding(18)
                .padding(.bottom, 28)
            }
        }
        .toolbar(.hidden, for: .navigationBar)
    }
}
