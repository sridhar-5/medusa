import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import {
  adminHeaders,
  createAdminUser,
  generatePublishableKey,
  generateStoreHeaders,
} from "../../../../helpers/create-admin-user"
import { createOrderSeeder } from "../../fixtures/order"

jest.setTimeout(300000)

medusaIntegrationTestRunner({
  testSuite: ({ dbConnection, getContainer, api }) => {
    let order
    let customer
    let user
    let registeredCustomerToken
    let storeHeaders

    beforeEach(async () => {
      const container = getContainer()

      user = (await createAdminUser(dbConnection, adminHeaders, container)).user
      const publishableKey = await generatePublishableKey(container)
      storeHeaders = generateStoreHeaders({ publishableKey })

      const seeders = await createOrderSeeder({ api, container })

      registeredCustomerToken = (
        await api.post("/auth/customer/emailpass/register", {
          email: "test@email.com",
          password: "password",
        })
      ).data.token

      customer = (
        await api.post(
          "/store/customers",
          {
            email: "test@email.com",
          },
          {
            headers: {
              Authorization: `Bearer ${registeredCustomerToken}`,
              ...storeHeaders.headers,
            },
          }
        )
      ).data.customer

      order = seeders.order
    })

    describe("Transfer Order flow", () => {
      it("should pass order transfer flow from admin successfully", async () => {
        await api.post(
          `/admin/orders/${order.id}/transfer`,
          {
            customer_id: customer.id,
          },
          adminHeaders
        )

        const orderResult = (
          await api.get(
            `/admin/orders/${order.id}?fields=+customer_id,+email`,
            adminHeaders
          )
        ).data.order

        expect(orderResult.email).toEqual("tony@stark-industries.com")
        expect(orderResult.customer_id).not.toEqual(customer.id) // didn't transfer anything yet

        const orderPreviewResult = (
          await api.get(`/admin/orders/${order.id}/preview`, adminHeaders)
        ).data.order

        expect(orderPreviewResult).toEqual(
          expect.objectContaining({
            customer_id: customer.id,
            order_change: expect.objectContaining({
              change_type: "transfer",
              status: "requested",
              requested_by: user.id,
            }),
            // TODO: preview doesn't return actions, and the route doesn't accept fields
            // actions: expect.arrayContaining([
            //   expect.objectContaining({
            //     version: 2,
            //     action: "TRANSFER_CUSTOMER",
            //     reference: "customer",
            //     reference_id: customer.id,
            //     details: expect.objectContaining({
            //       token: expect.any(String),
            //       original_email: "tony@stark-industries.com",
            //     }),
            //   }),
            // ]),
          })
        )

        const orderChangesResult = (
          await api.get(`/admin/orders/${order.id}/changes`, adminHeaders)
        ).data.order_changes

        expect(orderChangesResult.length).toEqual(1)
        expect(orderChangesResult[0]).toEqual(
          expect.objectContaining({
            change_type: "transfer",
            status: "requested",
            requested_by: user.id,
            created_by: user.id,
            confirmed_by: null,
            confirmed_at: null,
            declined_by: null,
            actions: expect.arrayContaining([
              expect.objectContaining({
                version: 2,
                action: "TRANSFER_CUSTOMER",
                reference: "customer",
                reference_id: customer.id,
                details: expect.objectContaining({
                  token: expect.any(String),
                  original_email: "tony@stark-industries.com",
                }),
              }),
            ]),
          })
        )

        await api.post(
          `/store/orders/${order.id}/transfer/accept`,
          { token: orderChangesResult[0].actions[0].details.token },
          {
            headers: {
              authorization: `Bearer ${registeredCustomerToken}`,
              ...storeHeaders.headers,
            },
          }
        )

        const finalOrderResult = (
          await api.get(
            `/admin/orders/${order.id}?fields=+customer_id,+email`,
            adminHeaders
          )
        ).data.order

        expect(finalOrderResult.email).toEqual("tony@stark-industries.com")
        expect(finalOrderResult.customer_id).toEqual(customer.id)
      })

      it("should fail to request order transfer to a guest customer", async () => {
        const customer = (
          await api.post(
            "/admin/customers",
            {
              first_name: "guest",
              email: "guest@medusajs.com",
            },
            adminHeaders
          )
        ).data.customer

        const err = await api
          .post(
            `/admin/orders/${order.id}/transfer`,
            {
              customer_id: customer.id,
            },
            adminHeaders
          )
          .catch((e) => e)

        expect(err.response.status).toBe(400)
        expect(err.response.data).toEqual(
          expect.objectContaining({
            type: "invalid_data",
            message: `Cannot transfer order: ${order.id} to a guest customer account: guest@medusajs.com`,
          })
        )
      })
    })
  },
})
