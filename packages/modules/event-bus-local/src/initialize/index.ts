import { MedusaModule } from "@medusajs/framework/modules-sdk"
import { IEventBusService } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"

export const initialize = async (): Promise<IEventBusService> => {
  const serviceKey = Modules.EVENT_BUS
  const loaded = await MedusaModule.bootstrap<IEventBusService>({
    moduleKey: serviceKey,
    defaultPath: "@medusajs/event-bus-local",
  })

  return loaded[serviceKey]
}
