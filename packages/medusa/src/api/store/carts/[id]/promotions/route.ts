import { updateCartPromotionsWorkflow } from "@medusajs/core-flows"
import { PromotionActions } from "@medusajs/utils"
import { MedusaRequest, MedusaResponse } from "../../../../../types/routing"
import { refetchCart } from "../../helpers"
import {
  StoreAddCartPromotionsType,
  StoreRemoveCartPromotionsType,
} from "../../validators"

export const POST = async (
  req: MedusaRequest<StoreAddCartPromotionsType>,
  res: MedusaResponse
) => {
  const workflow = updateCartPromotionsWorkflow(req.scope)
  const payload = req.validatedBody

  await workflow.run({
    input: {
      promo_codes: payload.promo_codes,
      cart_id: req.params.id,
      action: PromotionActions.ADD,
    },
  })

  const cart = await refetchCart(
    req.params.id,
    req.scope,
    req.remoteQueryConfig.fields
  )

  res.status(200).json({ cart })
}

export const DELETE = async (
  req: MedusaRequest<StoreRemoveCartPromotionsType>,
  res: MedusaResponse
) => {
  const workflow = updateCartPromotionsWorkflow(req.scope)
  const payload = req.validatedBody

  await workflow.run({
    input: {
      promo_codes: payload.promo_codes,
      cart_id: req.params.id,
      action: PromotionActions.REMOVE,
    },
  })

  const cart = await refetchCart(
    req.params.id,
    req.scope,
    req.remoteQueryConfig.fields
  )

  res.status(200).json({ cart })
}
