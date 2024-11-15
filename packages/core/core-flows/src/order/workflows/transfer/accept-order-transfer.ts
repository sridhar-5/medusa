import {
  OrderChangeDTO,
  OrderDTO,
  OrderWorkflow,
} from "@medusajs/framework/types"
import {
  WorkflowData,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { CustomerDTO, OrderPreviewDTO } from "@medusajs/types"

import { useRemoteQueryStep } from "../../../common"
import { throwIfOrderIsCancelled } from "../../utils/order-validation"
import { previewOrderChangeStep } from "../../steps"
import {
  ChangeActionType,
  MedusaError,
  OrderChangeStatus,
} from "@medusajs/utils"
import { confirmOrderChanges } from "../../steps/confirm-order-changes"

/**
 * This step validates that an order transfer can be accepted.
 */
export const acceptOrderTransferValidationStep = createStep(
  "accept-order-transfer-validation",
  async function ({
    token,
    order,
    customer,
    orderChange,
  }: {
    token: string
    customer: CustomerDTO
    order: OrderDTO
    orderChange: OrderChangeDTO
  }) {
    throwIfOrderIsCancelled({ order })

    if (!orderChange || orderChange.change_type !== "transfer") {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Order ${order.id} does not have an order transfer request.`
      )
    }
    const transferCustomerAction = orderChange.actions.find(
      (a) => a.action === ChangeActionType.TRANSFER_CUSTOMER
    )

    if (!token.length || token !== transferCustomerAction?.details!.token) {
      throw new MedusaError(MedusaError.Types.NOT_ALLOWED, "Invalid token.")
    }

    if (customer.id !== transferCustomerAction?.details!.reference_id) {
      throw new MedusaError(
        MedusaError.Types.INVALID_DATA,
        `Customer ${customer.id} didn't request this order transfer.`
      )
    }
  }
)

export const acceptOrderTransferWorkflowId = "accept-order-transfer-workflow"
/**
 * This workflow accepts an order transfer.
 */
export const acceptOrderTransferWorkflow = createWorkflow(
  acceptOrderTransferWorkflowId,
  function (
    input: WorkflowData<OrderWorkflow.AcceptOrderTransferWorkflowInput>
  ): WorkflowResponse<OrderPreviewDTO> {
    const order: OrderDTO = useRemoteQueryStep({
      entry_point: "orders",
      fields: ["id", "email", "status", "customer_id"],
      variables: { id: input.orderId },
      list: false,
      throw_if_key_not_found: true,
    })

    const customer = useRemoteQueryStep({
      entry_point: "customers",
      fields: ["id", "email", "has_account"],
      variables: { id: input.customerId },
      list: false,
      throw_if_key_not_found: true,
    }).config({ name: "customer-query" })

    const orderChange: OrderChangeDTO = useRemoteQueryStep({
      entry_point: "order_change",
      fields: [
        "id",
        "status",
        "change_type",
        "actions.id",
        "actions.order_id",
        "actions.action",
        "actions.details",
        "actions.reference",
        "actions.reference_id",
        "actions.internal_note",
      ],
      variables: {
        filters: {
          order_id: input.orderId,
          status: [OrderChangeStatus.REQUESTED],
        },
      },
      list: false,
    }).config({ name: "order-change-query" })

    acceptOrderTransferValidationStep({
      order,
      orderChange,
      customer,
      token: input.token,
    })

    confirmOrderChanges({
      changes: [orderChange],
      orderId: order.id,
      confirmed_by: input.customerId,
    })

    return new WorkflowResponse(previewOrderChangeStep(input.orderId))
  }
)
