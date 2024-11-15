import { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework"
import { HttpTypes } from "@medusajs/framework/types"
import {
  acceptOrderTransferWorkflow,
  getOrderDetailWorkflow,
} from "@medusajs/core-flows"

import { StoreAcceptOrderTransferType } from "../../../validators"

export const POST = async (
  req: AuthenticatedMedusaRequest<StoreAcceptOrderTransferType>,
  res: MedusaResponse<HttpTypes.StoreOrderResponse>
) => {
  const customerId = req.auth_context.actor_id

  await acceptOrderTransferWorkflow(req.scope).run({
    input: {
      customerId,
      orderId: req.params.id,
      token: req.validatedBody.token,
    },
  })

  const workflow = getOrderDetailWorkflow(req.scope)
  const { result } = await workflow.run({
    input: {
      fields: req.remoteQueryConfig.fields,
      order_id: req.params.id,
    },
  })

  res.status(200).json({ order: result as HttpTypes.StoreOrder })
}
