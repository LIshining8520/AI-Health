import Capacitor
import HealthKit
import UIKit
import UniformTypeIdentifiers
import PhotosUI
import ImageIO
import AVFoundation

@objc(HealthKitPlugin)
public class HealthKitPlugin: CAPPlugin, CAPBridgedPlugin, UIDocumentPickerDelegate, PHPickerViewControllerDelegate, UIImagePickerControllerDelegate, UINavigationControllerDelegate {
    public let identifier = "HealthKitPlugin"
    public let jsName = "HealthKit"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "pickImages", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "takePhoto", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFiles", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "pickFolder", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "exportData", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "isAvailable", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestReadAccess", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addWater", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "addWeight", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "readSummary", returnType: CAPPluginReturnPromise)
    ]
    private let store = HKHealthStore()

    private func isReadDenied(_ error: Error) -> Bool {
        let nsError = error as NSError
        return nsError.domain == HKErrorDomain && [HKError.Code.errorAuthorizationDenied.rawValue, HKError.Code.errorNoData.rawValue].contains(nsError.code)
    }

    private var imageCall: CAPPluginCall?

    private func photoAttachment(_ image: UIImage, name: String) throws -> [String: String] {
        let longest = max(image.size.width, image.size.height)
        guard longest > 0 else { throw NSError(domain: "Photos", code: 1, userInfo: [NSLocalizedDescriptionKey: "图片尺寸无效"]) }
        var scale = min(1, 1600 / longest)
        for _ in 0..<4 {
            let size = CGSize(width: max(1, image.size.width * scale), height: max(1, image.size.height * scale))
            let format = UIGraphicsImageRendererFormat()
            format.scale = 1
            format.opaque = true
            let resized = UIGraphicsImageRenderer(size: size, format: format).image { context in
                UIColor.white.setFill()
                context.fill(CGRect(origin: .zero, size: size))
                image.draw(in: CGRect(origin: .zero, size: size))
            }
            for quality in [0.8, 0.6, 0.4] {
                if let data = resized.jpegData(compressionQuality: quality), data.count <= 280_000 {
                    let safeName = String(URL(fileURLWithPath: name).deletingPathExtension().lastPathComponent.prefix(180))
                    return ["name": (safeName.isEmpty ? "照片" : safeName) + ".jpg", "data": data.base64EncodedString()]
                }
            }
            scale *= 0.7
        }
        throw NSError(domain: "Photos", code: 2, userInfo: [NSLocalizedDescriptionKey: "图片压缩失败，请尝试另一张图片"])
    }

    @objc func pickImages(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.imageCall == nil, let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                call.reject("请关闭当前系统弹窗后重试", "PICKER_BUSY"); return
            }
            self.imageCall = call
            var configuration = PHPickerConfiguration()
            configuration.filter = .images
            configuration.selectionLimit = 8
            configuration.preferredAssetRepresentationMode = .compatible
            let picker = PHPickerViewController(configuration: configuration)
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func picker(_ picker: PHPickerViewController, didFinishPicking results: [PHPickerResult]) {
        guard let call = imageCall else { picker.dismiss(animated: true); return }
        picker.dismiss(animated: true) {
            guard !results.isEmpty else {
                self.imageCall = nil; call.resolve(["files": [], "cancelled": true]); return
            }
            let group = DispatchGroup()
            let lock = NSLock()
            var files: [Int: [String: String]] = [:]
            var failure: Error?
            for (index, result) in results.enumerated() {
                group.enter()
                result.itemProvider.loadFileRepresentation(forTypeIdentifier: UTType.image.identifier) { url, error in
                    defer { group.leave() }
                    do {
                        if let error = error { throw error }
                        guard let url = url,
                              let source = CGImageSourceCreateWithURL(url as CFURL, nil),
                              let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1600] as CFDictionary) else {
                            throw NSError(domain: "Photos", code: 3, userInfo: [NSLocalizedDescriptionKey: "无法读取照片，请确认 iCloud 原图已下载后重试"])
                        }
                        let file = try self.photoAttachment(UIImage(cgImage: thumbnail), name: result.itemProvider.suggestedName ?? "照片-\(index + 1)")
                        lock.lock(); files[index] = file; lock.unlock()
                    } catch { lock.lock(); failure = error; lock.unlock() }
                }
            }
            group.notify(queue: .main) {
                self.imageCall = nil
                if let failure = failure { call.reject("图片读取失败：" + failure.localizedDescription, "PHOTO_READ_FAILED", failure) }
                else { call.resolve(["files": files.keys.sorted().compactMap { files[$0] }]) }
            }
        }
    }

    @objc func takePhoto(_ call: CAPPluginCall) {
        switch AVCaptureDevice.authorizationStatus(for: .video) {
        case .authorized: presentCamera(call)
        case .notDetermined:
            AVCaptureDevice.requestAccess(for: .video) { allowed in
                if allowed { self.presentCamera(call) }
                else { call.reject("未允许相机权限，请在 iPhone 设置中允许冷酸宁使用相机。", "CAMERA_DENIED") }
            }
        default: call.reject("未允许相机权限，请在 iPhone 设置中允许冷酸宁使用相机。", "CAMERA_DENIED")
        }
    }

    private func presentCamera(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard UIImagePickerController.isSourceTypeAvailable(.camera) else {
                call.reject("当前设备无法使用相机", "CAMERA_UNAVAILABLE"); return
            }
            guard self.imageCall == nil, let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                call.reject("请关闭当前系统弹窗后重试", "PICKER_BUSY"); return
            }
            self.imageCall = call
            let picker = UIImagePickerController()
            picker.sourceType = .camera
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func imagePickerControllerDidCancel(_ picker: UIImagePickerController) {
        let call = imageCall
        imageCall = nil
        picker.dismiss(animated: true) { call?.resolve(["files": [], "cancelled": true]) }
    }

    public func imagePickerController(_ picker: UIImagePickerController, didFinishPickingMediaWithInfo info: [UIImagePickerController.InfoKey: Any]) {
        let call = imageCall
        imageCall = nil
        picker.dismiss(animated: true) {
            guard let call = call, let image = info[.originalImage] as? UIImage else { call?.reject("未能读取拍摄的图片", "PHOTO_READ_FAILED"); return }
            do { call.resolve(["files": [try self.photoAttachment(image, name: "拍照-\(Int(Date().timeIntervalSince1970))")]]) }
            catch { call.reject(error.localizedDescription, "PHOTO_READ_FAILED", error) }
        }
    }

    private var filesCall: CAPPluginCall?

    @objc func pickFiles(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.filesCall == nil, self.folderCall == nil, self.imageCall == nil,
                  let controller = self.bridge?.viewController, controller.presentedViewController == nil else {
                call.reject("请关闭当前系统弹窗后重试", "PICKER_BUSY"); return
            }
            self.filesCall = call
            let types = [UTType.pdf, .image, .plainText, .commaSeparatedText, .json]
                + ["docx", "md"].compactMap { UTType(filenameExtension: $0) }
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: types, asCopy: true)
            picker.allowsMultipleSelection = true
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    private func selectedFileAttachment(_ url: URL) throws -> [String: String] {
        let scoped = url.startAccessingSecurityScopedResource()
        defer { if scoped { url.stopAccessingSecurityScopedResource() } }
        let ext = url.pathExtension.lowercased()
        let images: Set<String> = ["png", "jpg", "jpeg", "webp", "gif", "heic", "heif"]
        let documents: Set<String> = ["pdf", "docx", "txt", "md", "csv", "json"]
        guard images.contains(ext) || documents.contains(ext) else {
            throw NSError(domain: "Files", code: 6, userInfo: [NSLocalizedDescriptionKey: "不支持的文件格式：" + url.lastPathComponent])
        }
        var result: [String: String]?
        var readError: Error?
        var coordinationError: NSError?
        NSFileCoordinator().coordinate(readingItemAt: url, options: .withoutChanges, error: &coordinationError) { localURL in
            do {
                let size = try localURL.resourceValues(forKeys: [.fileSizeKey]).fileSize ?? 0
                guard size <= (images.contains(ext) ? 25_000_000 : 2_500_000) else {
                    throw NSError(domain: "Files", code: 7, userInfo: [NSLocalizedDescriptionKey: images.contains(ext) ? "图片超过 25 MB" : "文件超过 2.5 MB，请压缩或拆分后重试"])
                }
                if images.contains(ext) {
                    guard let source = CGImageSourceCreateWithURL(localURL as CFURL, nil),
                          let thumbnail = CGImageSourceCreateThumbnailAtIndex(source, 0, [kCGImageSourceCreateThumbnailFromImageAlways: true, kCGImageSourceCreateThumbnailWithTransform: true, kCGImageSourceThumbnailMaxPixelSize: 1600] as CFDictionary) else {
                        throw NSError(domain: "Files", code: 8, userInfo: [NSLocalizedDescriptionKey: "图片损坏或无法读取"])
                    }
                    result = try self.photoAttachment(UIImage(cgImage: thumbnail), name: url.lastPathComponent)
                } else {
                    let data = try Data(contentsOf: localURL)
                    guard !data.isEmpty, data.count <= 2_500_000 else {
                        throw NSError(domain: "Files", code: 9, userInfo: [NSLocalizedDescriptionKey: "文件为空或超过 2.5 MB"])
                    }
                    result = ["name": url.lastPathComponent, "data": data.base64EncodedString()]
                }
            } catch { readError = error }
        }
        if let error = coordinationError { throw error }
        if let error = readError { throw error }
        guard let result = result else { throw NSError(domain: "Files", code: 10, userInfo: [NSLocalizedDescriptionKey: "未能读取文件，请确认 iCloud 文件已下载后重试"]) }
        return result
    }

    private var folderCall: CAPPluginCall?

    @objc func pickFolder(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            guard self.folderCall == nil, let controller = self.bridge?.viewController,
                  controller.presentedViewController == nil else {
                call.reject("请关闭当前系统弹窗后重试", "PICKER_BUSY")
                return
            }
            self.folderCall = call
            let picker = UIDocumentPickerViewController(forOpeningContentTypes: [.folder], asCopy: false)
            picker.delegate = self
            controller.present(picker, animated: true)
        }
    }

    public func documentPickerWasCancelled(_ controller: UIDocumentPickerViewController) {
        filesCall?.resolve(["files": [], "cancelled": true])
        filesCall = nil
        folderCall?.resolve(["files": [], "cancelled": true])
        folderCall = nil
    }

    public func documentPicker(_ controller: UIDocumentPickerViewController, didPickDocumentsAt urls: [URL]) {
        if let call = filesCall {
            DispatchQueue.global(qos: .userInitiated).async {
                defer { DispatchQueue.main.async { self.filesCall = nil } }
                do {
                    guard urls.count <= 8 else { throw NSError(domain: "Files", code: 11, userInfo: [NSLocalizedDescriptionKey: "最多选择 8 个文件，请减少后重试"]) }
                    let files = try urls.map { try self.selectedFileAttachment($0) }
                    let size = files.reduce(0) { $0 + (Data(base64Encoded: $1["data"] ?? "")?.count ?? 0) }
                    guard size <= 2_500_000 else { throw NSError(domain: "Files", code: 12, userInfo: [NSLocalizedDescriptionKey: "附件合计超过 2.5 MB，请减少文件或拆分发送"]) }
                    call.resolve(["files": files])
                } catch { call.reject("文件读取失败：" + error.localizedDescription, "FILE_READ_FAILED", error) }
            }
            return
        }
        guard let call = folderCall else { return }
        folderCall = nil
        guard let root = urls.first else { call.resolve(["files": []]); return }
        DispatchQueue.global(qos: .userInitiated).async {
            let scoped = root.startAccessingSecurityScopedResource()
            defer { if scoped { root.stopAccessingSecurityScopedResource() } }
            do {
                let allowed: Set<String> = ["png", "jpg", "jpeg", "webp", "gif", "pdf", "docx", "txt", "md", "csv", "json"]
                var failure: Error?
                guard let entries = FileManager.default.enumerator(at: root, includingPropertiesForKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey], options: [.skipsHiddenFiles, .skipsPackageDescendants], errorHandler: { _, error in failure = error; return false }) else {
                    throw NSError(domain: "Files", code: 1, userInfo: [NSLocalizedDescriptionKey: "无法读取文件夹"])
                }
                var files: [[String: String]] = []
                var size = 0
                var examined = 0
                for case let url as URL in entries {
                    examined += 1
                    if examined > 500 { throw NSError(domain: "Files", code: 2, userInfo: [NSLocalizedDescriptionKey: "文件夹过大，请选择更小的子文件夹"]) }
                    let values = try url.resourceValues(forKeys: [.isRegularFileKey, .isSymbolicLinkKey, .fileSizeKey])
                    if values.isSymbolicLink == true { entries.skipDescendants(); continue }
                    guard values.isRegularFile == true, allowed.contains(url.pathExtension.lowercased()) else { continue }
                    size += values.fileSize ?? 0
                    if files.count >= 8 || size > 2_500_000 {
                        throw NSError(domain: "Files", code: 3, userInfo: [NSLocalizedDescriptionKey: "最多 8 个支持的文件，合计不超过 2.5 MB，请选择更小的文件夹"])
                    }
                    let data = try Data(contentsOf: url)
                    if data.count > 2_500_000 { throw NSError(domain: "Files", code: 4, userInfo: [NSLocalizedDescriptionKey: "文件超过 2.5 MB"]) }
                    let name = root.lastPathComponent + "/" + String(url.path.dropFirst(root.path.count + 1))
                    files.append(["name": name, "data": data.base64EncodedString()])
                }
                if let failure = failure { throw failure }
                if files.isEmpty { throw NSError(domain: "Files", code: 5, userInfo: [NSLocalizedDescriptionKey: "文件夹中没有可读取的图片、PDF、Word 或文本文件"]) }
                call.resolve(["files": files])
            } catch { call.reject(error.localizedDescription, "FOLDER_READ_FAILED", error) }
        }
    }

    @objc func exportData(_ call: CAPPluginCall) {
        guard let json = call.getString("json"), let data = json.data(using: .utf8),
              data.count <= 10_000_000,
              (try? JSONSerialization.jsonObject(with: data)) != nil else {
            call.reject("导出数据无效或过大", "INVALID_EXPORT")
            return
        }
        DispatchQueue.main.async {
            guard let controller = self.bridge?.viewController else {
                call.reject("暂时无法打开分享面板，请重试", "NO_CONTROLLER")
                return
            }
            let directory = FileManager.default.temporaryDirectory.appendingPathComponent(UUID().uuidString, isDirectory: true)
            do {
                try FileManager.default.createDirectory(at: directory, withIntermediateDirectories: true)
                let file = directory.appendingPathComponent("冷酸宁-健康记录.json")
                try data.write(to: file, options: [.atomic, .completeFileProtection])
                let sheet = UIActivityViewController(activityItems: [file], applicationActivities: nil)
                sheet.popoverPresentationController?.sourceView = controller.view
                sheet.popoverPresentationController?.sourceRect = CGRect(x: controller.view.bounds.midX, y: controller.view.bounds.midY, width: 1, height: 1)
                sheet.completionWithItemsHandler = { _, completed, _, error in
                    try? FileManager.default.removeItem(at: directory)
                    if let error = error { call.reject("导出失败：" + error.localizedDescription, "EXPORT_FAILED", error) }
                    else { call.resolve(["completed": completed]) }
                }
                guard controller.presentedViewController == nil else {
                    try? FileManager.default.removeItem(at: directory)
                    call.reject("请关闭当前系统弹窗后重试", "PRESENTATION_BUSY")
                    return
                }
                controller.present(sheet, animated: true)
            } catch {
                try? FileManager.default.removeItem(at: directory)
                call.reject("无法生成导出文件：" + error.localizedDescription, "EXPORT_FAILED", error)
            }
        }
    }

    @objc func isAvailable(_ call: CAPPluginCall) {
        call.resolve(["available": HKHealthStore.isHealthDataAvailable()])
    }

    @objc func addWater(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("此设备不支持 Apple 健康", "UNAVAILABLE")
            return
        }
        guard let milliliters = call.getDouble("milliliters"), milliliters.isFinite,
              milliliters > 0, milliliters <= 5000,
              let type = HKObjectType.quantityType(forIdentifier: .dietaryWater) else {
            call.reject("饮水量须在 0–5000 mL 之间", "INVALID_AMOUNT")
            return
        }
        store.requestAuthorization(toShare: [type], read: [type]) { completed, error in
            guard completed, self.store.authorizationStatus(for: type) == .sharingAuthorized else {
                call.reject("未允许写入饮水，请在「健康」中开启冷酸宁的饮水写入权限。", "WRITE_DENIED", error)
                return
            }
            let now = Date()
            let sample = HKQuantitySample(type: type, quantity: HKQuantity(unit: .literUnit(with: .milli), doubleValue: milliliters), start: now, end: now)
            self.store.save(sample) { saved, error in
                if saved { call.resolve(["saved": true]) }
                else { call.reject("饮水保存失败：" + (error?.localizedDescription ?? "请重试"), "SAVE_FAILED", error) }
            }
        }
    }

    @objc func addWeight(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("此设备不支持 Apple 健康", "UNAVAILABLE")
            return
        }
        guard let kilograms = call.getDouble("kilograms"), kilograms.isFinite,
              kilograms >= 1, kilograms <= 500,
              let type = HKObjectType.quantityType(forIdentifier: .bodyMass) else {
            call.reject("体重须在 1–500 kg 之间", "INVALID_AMOUNT")
            return
        }
        store.requestAuthorization(toShare: [type], read: [type]) { completed, error in
            guard completed, self.store.authorizationStatus(for: type) == .sharingAuthorized else {
                call.reject("未允许写入体重，请在「健康」中开启冷酸宁的体重写入权限。", "WRITE_DENIED", error)
                return
            }
            let now = Date()
            let sample = HKQuantitySample(type: type, quantity: HKQuantity(unit: .gramUnit(with: .kilo), doubleValue: kilograms), start: now, end: now)
            self.store.save(sample) { saved, error in
                if saved { call.resolve(["saved": true]) }
                else { call.reject("体重保存失败：" + (error?.localizedDescription ?? "请重试"), "SAVE_FAILED", error) }
            }
        }
    }

    @objc func requestReadAccess(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("此设备不支持 Apple 健康", "UNAVAILABLE")
            return
        }
        // SDK identifier catalog; compactMap skips types unavailable on this iOS version.
        var types: Set<HKObjectType> = [HKObjectType.workoutType(), HKObjectType.activitySummaryType()]
        let quantityTypeNames = [
            "HKQuantityTypeIdentifierActiveEnergyBurned",
            "HKQuantityTypeIdentifierAppleExerciseTime",
            "HKQuantityTypeIdentifierAppleMoveTime",
            "HKQuantityTypeIdentifierAppleSleepingBreathingDisturbances",
            "HKQuantityTypeIdentifierAppleSleepingWristTemperature",
            "HKQuantityTypeIdentifierAppleStandTime",
            "HKQuantityTypeIdentifierAppleWalkingSteadiness",
            "HKQuantityTypeIdentifierAtrialFibrillationBurden",
            "HKQuantityTypeIdentifierBasalBodyTemperature",
            "HKQuantityTypeIdentifierBasalEnergyBurned",
            "HKQuantityTypeIdentifierBloodAlcoholContent",
            "HKQuantityTypeIdentifierBloodGlucose",
            "HKQuantityTypeIdentifierBloodPressureDiastolic",
            "HKQuantityTypeIdentifierBloodPressureSystolic",
            "HKQuantityTypeIdentifierBodyFatPercentage",
            "HKQuantityTypeIdentifierBodyMass",
            "HKQuantityTypeIdentifierBodyMassIndex",
            "HKQuantityTypeIdentifierBodyTemperature",
            "HKQuantityTypeIdentifierCrossCountrySkiingSpeed",
            "HKQuantityTypeIdentifierCyclingCadence",
            "HKQuantityTypeIdentifierCyclingFunctionalThresholdPower",
            "HKQuantityTypeIdentifierCyclingPower",
            "HKQuantityTypeIdentifierCyclingSpeed",
            "HKQuantityTypeIdentifierDietaryBiotin",
            "HKQuantityTypeIdentifierDietaryCaffeine",
            "HKQuantityTypeIdentifierDietaryCalcium",
            "HKQuantityTypeIdentifierDietaryCarbohydrates",
            "HKQuantityTypeIdentifierDietaryChloride",
            "HKQuantityTypeIdentifierDietaryCholesterol",
            "HKQuantityTypeIdentifierDietaryChromium",
            "HKQuantityTypeIdentifierDietaryCopper",
            "HKQuantityTypeIdentifierDietaryEnergyConsumed",
            "HKQuantityTypeIdentifierDietaryFatMonounsaturated",
            "HKQuantityTypeIdentifierDietaryFatPolyunsaturated",
            "HKQuantityTypeIdentifierDietaryFatSaturated",
            "HKQuantityTypeIdentifierDietaryFatTotal",
            "HKQuantityTypeIdentifierDietaryFiber",
            "HKQuantityTypeIdentifierDietaryFolate",
            "HKQuantityTypeIdentifierDietaryIodine",
            "HKQuantityTypeIdentifierDietaryIron",
            "HKQuantityTypeIdentifierDietaryMagnesium",
            "HKQuantityTypeIdentifierDietaryManganese",
            "HKQuantityTypeIdentifierDietaryMolybdenum",
            "HKQuantityTypeIdentifierDietaryNiacin",
            "HKQuantityTypeIdentifierDietaryPantothenicAcid",
            "HKQuantityTypeIdentifierDietaryPhosphorus",
            "HKQuantityTypeIdentifierDietaryPotassium",
            "HKQuantityTypeIdentifierDietaryProtein",
            "HKQuantityTypeIdentifierDietaryRiboflavin",
            "HKQuantityTypeIdentifierDietarySelenium",
            "HKQuantityTypeIdentifierDietarySodium",
            "HKQuantityTypeIdentifierDietarySugar",
            "HKQuantityTypeIdentifierDietaryThiamin",
            "HKQuantityTypeIdentifierDietaryVitaminA",
            "HKQuantityTypeIdentifierDietaryVitaminB12",
            "HKQuantityTypeIdentifierDietaryVitaminB6",
            "HKQuantityTypeIdentifierDietaryVitaminC",
            "HKQuantityTypeIdentifierDietaryVitaminD",
            "HKQuantityTypeIdentifierDietaryVitaminE",
            "HKQuantityTypeIdentifierDietaryVitaminK",
            "HKQuantityTypeIdentifierDietaryWater",
            "HKQuantityTypeIdentifierDietaryZinc",
            "HKQuantityTypeIdentifierDistanceCrossCountrySkiing",
            "HKQuantityTypeIdentifierDistanceCycling",
            "HKQuantityTypeIdentifierDistanceDownhillSnowSports",
            "HKQuantityTypeIdentifierDistancePaddleSports",
            "HKQuantityTypeIdentifierDistanceRowing",
            "HKQuantityTypeIdentifierDistanceSkatingSports",
            "HKQuantityTypeIdentifierDistanceSwimming",
            "HKQuantityTypeIdentifierDistanceWalkingRunning",
            "HKQuantityTypeIdentifierDistanceWheelchair",
            "HKQuantityTypeIdentifierElectrodermalActivity",
            "HKQuantityTypeIdentifierEnvironmentalAudioExposure",
            "HKQuantityTypeIdentifierEnvironmentalSoundReduction",
            "HKQuantityTypeIdentifierEstimatedWorkoutEffortScore",
            "HKQuantityTypeIdentifierFlightsClimbed",
            "HKQuantityTypeIdentifierForcedExpiratoryVolume1",
            "HKQuantityTypeIdentifierForcedVitalCapacity",
            "HKQuantityTypeIdentifierHeadphoneAudioExposure",
            "HKQuantityTypeIdentifierHeartRate",
            "HKQuantityTypeIdentifierHeartRateRecoveryOneMinute",
            "HKQuantityTypeIdentifierHeartRateVariabilityRMSSD",
            "HKQuantityTypeIdentifierHeartRateVariabilitySDNN",
            "HKQuantityTypeIdentifierHeight",
            "HKQuantityTypeIdentifierInhalerUsage",
            "HKQuantityTypeIdentifierInsulinDelivery",
            "HKQuantityTypeIdentifierLeanBodyMass",
            "HKQuantityTypeIdentifierNikeFuel",
            "HKQuantityTypeIdentifierNumberOfAlcoholicBeverages",
            "HKQuantityTypeIdentifierNumberOfTimesFallen",
            "HKQuantityTypeIdentifierOxygenSaturation",
            "HKQuantityTypeIdentifierPaddleSportsSpeed",
            "HKQuantityTypeIdentifierPeakExpiratoryFlowRate",
            "HKQuantityTypeIdentifierPeripheralPerfusionIndex",
            "HKQuantityTypeIdentifierPhysicalEffort",
            "HKQuantityTypeIdentifierPushCount",
            "HKQuantityTypeIdentifierRespiratoryRate",
            "HKQuantityTypeIdentifierRestingHeartRate",
            "HKQuantityTypeIdentifierRowingSpeed",
            "HKQuantityTypeIdentifierRunningGroundContactTime",
            "HKQuantityTypeIdentifierRunningPower",
            "HKQuantityTypeIdentifierRunningSpeed",
            "HKQuantityTypeIdentifierRunningStrideLength",
            "HKQuantityTypeIdentifierRunningVerticalOscillation",
            "HKQuantityTypeIdentifierSixMinuteWalkTestDistance",
            "HKQuantityTypeIdentifierStairAscentSpeed",
            "HKQuantityTypeIdentifierStairDescentSpeed",
            "HKQuantityTypeIdentifierStepCount",
            "HKQuantityTypeIdentifierSwimmingStrokeCount",
            "HKQuantityTypeIdentifierTimeInDaylight",
            "HKQuantityTypeIdentifierUVExposure",
            "HKQuantityTypeIdentifierUnderwaterDepth",
            "HKQuantityTypeIdentifierVO2Max",
            "HKQuantityTypeIdentifierWaistCircumference",
            "HKQuantityTypeIdentifierWalkingAsymmetryPercentage",
            "HKQuantityTypeIdentifierWalkingDoubleSupportPercentage",
            "HKQuantityTypeIdentifierWalkingHeartRateAverage",
            "HKQuantityTypeIdentifierWalkingSpeed",
            "HKQuantityTypeIdentifierWalkingStepLength",
            "HKQuantityTypeIdentifierWaterTemperature",
            "HKQuantityTypeIdentifierWorkoutEffortScore",
        ]
        types.formUnion(quantityTypeNames.compactMap { HKObjectType.quantityType(forIdentifier: HKQuantityTypeIdentifier(rawValue: $0)) })
        let categoryTypeNames = [
            "HKCategoryTypeIdentifierAbdominalCramps",
            "HKCategoryTypeIdentifierAcne",
            "HKCategoryTypeIdentifierAppetiteChanges",
            "HKCategoryTypeIdentifierAppleStandHour",
            "HKCategoryTypeIdentifierAppleWalkingSteadinessEvent",
            "HKCategoryTypeIdentifierAudioExposureEvent",
            "HKCategoryTypeIdentifierBladderIncontinence",
            "HKCategoryTypeIdentifierBleedingAfterMenopause",
            "HKCategoryTypeIdentifierBleedingAfterPregnancy",
            "HKCategoryTypeIdentifierBleedingDuringPregnancy",
            "HKCategoryTypeIdentifierBloating",
            "HKCategoryTypeIdentifierBreastPain",
            "HKCategoryTypeIdentifierCervicalMucusQuality",
            "HKCategoryTypeIdentifierChestTightnessOrPain",
            "HKCategoryTypeIdentifierChills",
            "HKCategoryTypeIdentifierConstipation",
            "HKCategoryTypeIdentifierContraceptive",
            "HKCategoryTypeIdentifierCoughing",
            "HKCategoryTypeIdentifierDiarrhea",
            "HKCategoryTypeIdentifierDizziness",
            "HKCategoryTypeIdentifierDrySkin",
            "HKCategoryTypeIdentifierEnvironmentalAudioExposureEvent",
            "HKCategoryTypeIdentifierFainting",
            "HKCategoryTypeIdentifierFatigue",
            "HKCategoryTypeIdentifierFever",
            "HKCategoryTypeIdentifierGeneralizedBodyAche",
            "HKCategoryTypeIdentifierHairLoss",
            "HKCategoryTypeIdentifierHandwashingEvent",
            "HKCategoryTypeIdentifierHeadache",
            "HKCategoryTypeIdentifierHeadphoneAudioExposureEvent",
            "HKCategoryTypeIdentifierHeartburn",
            "HKCategoryTypeIdentifierHighHeartRateEvent",
            "HKCategoryTypeIdentifierHotFlashes",
            "HKCategoryTypeIdentifierHypertensionEvent",
            "HKCategoryTypeIdentifierInfrequentMenstrualCycles",
            "HKCategoryTypeIdentifierIntermenstrualBleeding",
            "HKCategoryTypeIdentifierIrregularHeartRhythmEvent",
            "HKCategoryTypeIdentifierIrregularMenstrualCycles",
            "HKCategoryTypeIdentifierLactation",
            "HKCategoryTypeIdentifierLossOfSmell",
            "HKCategoryTypeIdentifierLossOfTaste",
            "HKCategoryTypeIdentifierLowCardioFitnessEvent",
            "HKCategoryTypeIdentifierLowHeartRateEvent",
            "HKCategoryTypeIdentifierLowerBackPain",
            "HKCategoryTypeIdentifierMemoryLapse",
            "HKCategoryTypeIdentifierMenopausalState",
            "HKCategoryTypeIdentifierMenstrualFlow",
            "HKCategoryTypeIdentifierMindfulSession",
            "HKCategoryTypeIdentifierMoodChanges",
            "HKCategoryTypeIdentifierNausea",
            "HKCategoryTypeIdentifierNightSweats",
            "HKCategoryTypeIdentifierOvulationTestResult",
            "HKCategoryTypeIdentifierPelvicPain",
            "HKCategoryTypeIdentifierPersistentIntermenstrualBleeding",
            "HKCategoryTypeIdentifierPregnancy",
            "HKCategoryTypeIdentifierPregnancyTestResult",
            "HKCategoryTypeIdentifierProgesteroneTestResult",
            "HKCategoryTypeIdentifierProlongedMenstrualPeriods",
            "HKCategoryTypeIdentifierRapidPoundingOrFlutteringHeartbeat",
            "HKCategoryTypeIdentifierRunnyNose",
            "HKCategoryTypeIdentifierSexualActivity",
            "HKCategoryTypeIdentifierShortnessOfBreath",
            "HKCategoryTypeIdentifierSinusCongestion",
            "HKCategoryTypeIdentifierSkippedHeartbeat",
            "HKCategoryTypeIdentifierSleepAnalysis",
            "HKCategoryTypeIdentifierSleepApneaEvent",
            "HKCategoryTypeIdentifierSleepChanges",
            "HKCategoryTypeIdentifierSoreThroat",
            "HKCategoryTypeIdentifierToothbrushingEvent",
            "HKCategoryTypeIdentifierVaginalDryness",
            "HKCategoryTypeIdentifierVomiting",
            "HKCategoryTypeIdentifierWheezing",
        ]
        types.formUnion(categoryTypeNames.compactMap { HKObjectType.categoryType(forIdentifier: HKCategoryTypeIdentifier(rawValue: $0)) })
        let characteristicTypeNames = [
            "HKCharacteristicTypeIdentifierActivityMoveMode",
            "HKCharacteristicTypeIdentifierBiologicalSex",
            "HKCharacteristicTypeIdentifierBloodType",
            "HKCharacteristicTypeIdentifierDateOfBirth",
            "HKCharacteristicTypeIdentifierFitzpatrickSkinType",
            "HKCharacteristicTypeIdentifierWheelchairUse",
        ]
        types.formUnion(characteristicTypeNames.compactMap { HKObjectType.characteristicType(forIdentifier: HKCharacteristicTypeIdentifier(rawValue: $0)) })
        DispatchQueue.main.async {
            self.store.requestAuthorization(toShare: [], read: types) { completed, error in
                if let error = error { call.reject("无法完成健康数据授权请求：\(error.localizedDescription)", "AUTH_REQUEST_FAILED", error); return }
                // Completion is NOT proof that read access was granted. Apple hides read permission status.
                call.resolve(["requestCompleted": completed])
            }
        }
    }

    @objc func readSummary(_ call: CAPPluginCall) {
        guard HKHealthStore.isHealthDataAvailable() else {
            call.reject("此设备不支持 Apple 健康", "UNAVAILABLE")
            return
        }
        let now = Date()
        var calendar = Calendar(identifier: .gregorian)
        calendar.timeZone = TimeZone(identifier: "Asia/Shanghai")!
        let formatter = DateFormatter()
        formatter.calendar = calendar
        formatter.timeZone = calendar.timeZone
        formatter.dateFormat = "yyyy-MM-dd"
        let selectedDay = call.getString("date").flatMap { formatter.date(from: $0) } ?? now
        let today = calendar.startOfDay(for: selectedDay)
        let dayEnd = min(now, calendar.date(byAdding: .day, value: 1, to: today)!)
        let yesterday = calendar.date(byAdding: .day, value: -1, to: today)!
        let sleepStart = calendar.date(byAdding: .hour, value: 18, to: yesterday)!
        let sleepEnd = min(now, calendar.date(byAdding: .hour, value: 12, to: today)!)
        let sleepWindow = DateInterval(start: sleepStart, end: sleepEnd)
        let group = DispatchGroup()
        let results = DispatchQueue(label: "com.zhikang.health.results")
        var summary: [String: Any] = [
            "hrvHistory": [], "weightHistory": [], "workouts": [], "dataDate": formatter.string(from: today), "hrv": NSNull(), "heartRate": NSNull(), "noise": NSNull(), "waterMl": NSNull(), "fitness": NSNull(), "steps": NSNull(), "weightKg": NSNull(), "sleepHours": NSNull(),
            "weightDate": NSNull(), "syncedAt": ISO8601DateFormatter().string(from: now),
            "sleepStart": ISO8601DateFormatter().string(from: sleepStart),
            "sleepEnd": ISO8601DateFormatter().string(from: sleepEnd)
        ]
        var failures: [String] = []
        var activityMetrics: [String: Any] = [:]
        var activityGoals: [String: Any] = [:]

        group.enter()
        let stepType = HKObjectType.quantityType(forIdentifier: .stepCount)!
        let stepQuery = HKStatisticsQuery(quantityType: stepType,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate),
            options: .cumulativeSum) { _, statistics, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("步数：\(error.localizedDescription)") }
                if let sum = statistics?.sumQuantity() { summary["steps"] = sum.doubleValue(for: .count()) }
                group.leave()
            }
        }
        store.execute(stepQuery)

        group.enter()
        let weightType = HKObjectType.quantityType(forIdentifier: .bodyMass)!
        let weightQuery = HKSampleQuery(sampleType: weightType,
            predicate: HKQuery.predicateForSamples(withStart: nil, end: now), limit: HKObjectQueryNoLimit,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("体重：\(error.localizedDescription)") }
                if let sample = samples?.first as? HKQuantitySample {
                    summary["weightKg"] = sample.quantity.doubleValue(for: .gramUnit(with: .kilo))
                    summary["weightDate"] = ISO8601DateFormatter().string(from: sample.endDate)
                }
                var daily: [String: [String: Any]] = [:]
                // Samples are newest first; retain the latest measurement for each local date.
                for sample in samples as? [HKQuantitySample] ?? [] {
                    let date = formatter.string(from: sample.endDate)
                    if daily[date] == nil {
                        daily[date] = ["date": date, "value": sample.quantity.doubleValue(for: .gramUnit(with: .kilo)),
                                       "source": "Apple 健康 · " + sample.sourceRevision.source.name]
                    }
                }
                summary["weightHistory"] = daily.keys.sorted().compactMap { daily[$0] }
                group.leave()
            }
        }
        store.execute(weightQuery)

        group.enter()
        let sleepType = HKObjectType.categoryType(forIdentifier: .sleepAnalysis)!
        let sleepQuery = HKSampleQuery(sampleType: sleepType,
            predicate: HKQuery.predicateForSamples(withStart: sleepStart, end: sleepEnd),
            limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            let intervals = (samples as? [HKCategorySample] ?? []).filter { sample in
                if sample.value == HKCategoryValueSleepAnalysis.asleep.rawValue { return true }
                if #available(iOS 16.0, *) {
                    return [HKCategoryValueSleepAnalysis.asleepCore.rawValue,
                            HKCategoryValueSleepAnalysis.asleepDeep.rawValue,
                            HKCategoryValueSleepAnalysis.asleepREM.rawValue].contains(sample.value)
                }
                return false
            }.map { DateInterval(start: $0.startDate, end: $0.endDate) }
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("睡眠：\(error.localizedDescription)") }
                if let hours = mergedSleepHours(intervals, window: sleepWindow) { summary["sleepHours"] = hours }
                group.leave()
            }
        }
        store.execute(sleepQuery)
        group.enter()
        let heartQuery = HKStatisticsQuery(quantityType: HKObjectType.quantityType(forIdentifier: .heartRate)!,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate), options: .discreteAverage) { _, stats, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("心率：\(error.localizedDescription)") }
                if let value = stats?.averageQuantity() { summary["heartRate"] = value.doubleValue(for: HKUnit.count().unitDivided(by: .minute())) }
                group.leave()
            }
        }
        store.execute(heartQuery)

        group.enter()
        let hrvQuery = HKSampleQuery(sampleType: HKObjectType.quantityType(forIdentifier: .heartRateVariabilitySDNN)!,
            predicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate), limit: HKObjectQueryNoLimit,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("HRV：\(error.localizedDescription)") }
                let readings = (samples as? [HKQuantitySample] ?? []).filter {
                    let value = $0.quantity.doubleValue(for: .secondUnit(with: .milli))
                    return value.isFinite && value > 0
                }
                let selectedReadings = readings.filter { $0.startDate >= today && $0.startDate < dayEnd }
                summary["hrvHistory"] = selectedReadings.sorted { $0.startDate < $1.startDate }.map {
                    ["at": ISO8601DateFormatter().string(from: $0.startDate),
                     "value": $0.quantity.doubleValue(for: .secondUnit(with: .milli))] as [String: Any]
                }
                if let latest = selectedReadings.first {
                    let values = selectedReadings.map { $0.quantity.doubleValue(for: .secondUnit(with: .milli)) }
                    summary["hrv"] = ["value": values[0], "average": values.reduce(0, +) / Double(values.count),
                        "at": ISO8601DateFormatter().string(from: latest.endDate)]
                }
                group.leave()
            }
        }
        store.execute(hrvQuery)

        group.enter()
        let noiseQuery = HKSampleQuery(sampleType: HKObjectType.quantityType(forIdentifier: .environmentalAudioExposure)!,
            predicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate), limit: 1,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierEndDate, ascending: false)]) { _, samples, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("环境噪音：\(error.localizedDescription)") }
                if let value = samples?.first as? HKQuantitySample {
                    summary["noise"] = ["value": value.quantity.doubleValue(for: .decibelAWeightedSoundPressureLevel()), "at": ISO8601DateFormatter().string(from: value.endDate)]
                }
                group.leave()
            }
        }
        store.execute(noiseQuery)

        group.enter()
        let waterQuery = HKStatisticsQuery(quantityType: HKObjectType.quantityType(forIdentifier: .dietaryWater)!,
            quantitySamplePredicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate), options: .cumulativeSum) { _, stats, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("饮水：\(error.localizedDescription)") }
                if let value = stats?.sumQuantity() { summary["waterMl"] = value.doubleValue(for: .literUnit(with: .milli)) }
                group.leave()
            }
        }
        store.execute(waterQuery)

        group.enter()
        var components = calendar.dateComponents([.era, .year, .month, .day], from: today)
        // HealthKit raises an Objective-C exception if the Gregorian calendar is absent.
        components.calendar = calendar
        components.timeZone = calendar.timeZone
        var goalStart = calendar.dateComponents([.era, .year, .month, .day], from: calendar.date(byAdding: .year, value: -1, to: today)!)
        goalStart.calendar = calendar
        goalStart.timeZone = calendar.timeZone
        let activityPredicate = HKQuery.predicate(forActivitySummariesBetweenStart: goalStart, end: components)
        let activityQuery = HKActivitySummaryQuery(predicate: activityPredicate) { _, summaries, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("健身活动：\(error.localizedDescription)") }
                let ordered = (summaries ?? []).sorted {
                    (calendar.date(from: $0.dateComponents(for: calendar)) ?? .distantPast) <
                    (calendar.date(from: $1.dateComponents(for: calendar)) ?? .distantPast)
                }
                if let latest = ordered.last {
                    activityGoals["activeGoal"] = latest.activeEnergyBurnedGoal.doubleValue(for: .kilocalorie())
                    if #available(iOS 16.0, *) {
                        activityGoals["exerciseGoal"] = latest.exerciseTimeGoal.map { $0.doubleValue(for: .minute()) } ?? NSNull()
                        activityGoals["standGoal"] = latest.standHoursGoal.map { $0.doubleValue(for: .count()) } ?? NSNull()
                    } else {
                        activityGoals["exerciseGoal"] = latest.appleExerciseTimeGoal.doubleValue(for: .minute())
                        activityGoals["standGoal"] = latest.appleStandHoursGoal.doubleValue(for: .count())
                    }
                    activityGoals["goalDate"] = formatter.string(from: calendar.date(from: latest.dateComponents(for: calendar))!)
                }
                if let activity = ordered.last, calendar.isDate(calendar.date(from: activity.dateComponents(for: calendar))!, inSameDayAs: today) {
                    var dailyFitness: [String: Any] = [
                        "activeKcal": activity.activeEnergyBurned.doubleValue(for: .kilocalorie()),
                        "activeGoal": activity.activeEnergyBurnedGoal.doubleValue(for: .kilocalorie()),
                        "exerciseMinutes": activity.appleExerciseTime.doubleValue(for: .minute()),
                        "exerciseGoal": activity.appleExerciseTimeGoal.doubleValue(for: .minute()),
                        "standHours": activity.appleStandHours.doubleValue(for: .count()),
                        "standGoal": activity.appleStandHoursGoal.doubleValue(for: .count())
                    ]
                    dailyFitness.merge(activityGoals) { _, new in new }
                    summary["fitness"] = dailyFitness
                }
                group.leave()
            }
        }
        store.execute(activityQuery)
        group.enter()
        let workoutQuery = HKSampleQuery(sampleType: HKObjectType.workoutType(),
            predicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate),
            limit: HKObjectQueryNoLimit,
            sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]) { _, samples, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("体能训练：\(error.localizedDescription)") }
                summary["workouts"] = (samples as? [HKWorkout] ?? []).map { workout -> [String: Any] in
                    let type: String
                    switch workout.workoutActivityType {
                    case .walking: type = "Walking"
                    case .running: type = "Running"
                    case .cycling: type = "Cycling"
                    case .swimming: type = "Swimming"
                    case .yoga: type = "Yoga"
                    case .hiking: type = "Hiking"
                    case .traditionalStrengthTraining: type = "TraditionalStrengthTraining"
                    case .functionalStrengthTraining: type = "FunctionalStrengthTraining"
                    case .highIntensityIntervalTraining: type = "HighIntensityIntervalTraining"
                    case .dance: type = "Dance"
                    case .elliptical: type = "Elliptical"
                    case .rowing: type = "Rowing"
                    default: type = "Other"
                    }
                    return ["type": type, "start": ISO8601DateFormatter().string(from: workout.startDate),
                            "end": ISO8601DateFormatter().string(from: workout.endDate),
                            "minutes": workout.duration / 60,
                            "kcal": workout.totalEnergyBurned.map { $0.doubleValue(for: .kilocalorie()) } ?? NSNull(),
                            "source": workout.sourceRevision.source.name]
                }
                group.leave()
            }
        }
        store.execute(workoutQuery)
        for (identifier, key, unit) in [
            (HKQuantityTypeIdentifier.activeEnergyBurned, "activeKcal", HKUnit.kilocalorie()),
            (HKQuantityTypeIdentifier.appleExerciseTime, "exerciseMinutes", HKUnit.minute())
        ] {
            group.enter()
            let query = HKStatisticsQuery(quantityType: HKObjectType.quantityType(forIdentifier: identifier)!,
                quantitySamplePredicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate), options: .cumulativeSum) { _, stats, error in
                results.async {
                    if let error = error, !self.isReadDenied(error) { failures.append("活动指标：\(error.localizedDescription)") }
                    if let quantity = stats?.sumQuantity() { activityMetrics[key] = quantity.doubleValue(for: unit) }
                    group.leave()
                }
            }
            store.execute(query)
        }
        group.enter()
        let standQuery = HKSampleQuery(sampleType: HKObjectType.categoryType(forIdentifier: .appleStandHour)!,
            predicate: HKQuery.predicateForSamples(withStart: today, end: dayEnd, options: .strictStartDate),
            limit: HKObjectQueryNoLimit, sortDescriptors: nil) { _, samples, error in
            results.async {
                if let error = error, !self.isReadDenied(error) { failures.append("站立：\(error.localizedDescription)") }
                if let samples = samples as? [HKCategorySample], !samples.isEmpty {
                    let hours = Set(samples.filter { $0.value == HKCategoryValueAppleStandHour.stood.rawValue }
                        .map { Int($0.startDate.timeIntervalSince1970 / 3600) })
                    activityMetrics["standHours"] = hours.count
                }
                group.leave()
            }
        }
        store.execute(standQuery)
        group.notify(queue: results) {
            if summary["fitness"] is NSNull && !activityMetrics.isEmpty {
                var fitness: [String: Any] = ["activeKcal": NSNull(), "exerciseMinutes": NSNull(), "standHours": NSNull(),
                    "activeGoal": NSNull(), "exerciseGoal": NSNull(), "standGoal": NSNull(), "source": "独立活动指标"]
                fitness.merge(activityMetrics) { _, new in new }
                summary["fitness"] = fitness
            }
            if summary["fitness"] is NSNull, let workouts = summary["workouts"] as? [[String: Any]], !workouts.isEmpty {
                let energy = workouts.compactMap { $0["kcal"] as? Double }
                let minutes = workouts.compactMap { $0["minutes"] as? Double }.reduce(0, +)
                summary["fitness"] = ["activeKcal": energy.isEmpty ? NSNull() : energy.reduce(0, +) as Any,
                    "exerciseMinutes": minutes, "standHours": NSNull(), "activeGoal": NSNull(),
                    "exerciseGoal": NSNull(), "standGoal": NSNull(), "source": "体能训练汇总（非全天活动，消耗仅统计有记录项）", "workoutOnly": true]
            }
            if var fitness = summary["fitness"] as? [String: Any], fitness["workoutOnly"] as? Bool != true {
                fitness.merge(activityGoals) { _, new in new }
                summary["fitness"] = fitness
            }
            summary["warnings"] = failures
            let hasData = ["steps", "weightKg", "sleepHours", "hrv", "heartRate", "noise", "waterMl", "fitness"].contains { !(summary[$0] is NSNull) }
            if !hasData && (summary["workouts"] as? [[String: Any]] ?? []).isEmpty && !failures.isEmpty {
                call.reject("读取失败：" + failures.joined(separator: "；"), "READ_FAILED")
            } else {
                call.resolve(summary)
            }
        }
    }
}
