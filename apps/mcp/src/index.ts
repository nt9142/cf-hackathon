import { createFiberplane, createOpenAPISpec } from "@fiberplane/hono";
import { drizzle } from "drizzle-orm/d1";
import { Hono } from "hono";
import { streamSSE } from "hono/streaming";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StreamableHTTPTransport } from "@hono/mcp";
import { z } from "zod";
import { eq, and, gte, lte, desc, sql } from "drizzle-orm";
import * as schema from "./db/schema";

type Bindings = {
  DB: D1Database;
};

const app = new Hono<{ Bindings: Bindings }>();

// Validation schemas
const addExpenseSchema = z.object({
  amount: z.number().positive(),
  description: z.string().min(1),
  category: z.string().min(1),
  date: z.string().optional(),
  currency: z.string().default("USD"),
  tags: z.array(z.string()).optional(),
  paymentMethod: z.string().optional(),
  receipt: z.string().optional(),
});

const getExpensesSchema = z.object({
  category: z.string().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  tags: z.array(z.string()).optional(),
  limit: z.number().default(50),
  offset: z.number().default(0),
});

const updateExpenseSchema = z.object({
  id: z.number(),
  amount: z.number().positive().optional(),
  description: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  date: z.string().optional(),
  currency: z.string().optional(),
  tags: z.array(z.string()).optional(),
  paymentMethod: z.string().optional(),
  receipt: z.string().optional(),
});

const deleteExpenseSchema = z.object({
  id: z.number(),
});

const getExpenseSummarySchema = z.object({
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  groupBy: z.enum(["category", "month", "paymentMethod"]).optional(),
  currency: z.string().optional(),
});

function createMcpServer(db: any) {
  const server = new McpServer({
    name: "expenses-tracker",
    version: "1.0.0",
    description: "MCP server for tracking and managing expenses"
  });

  // Add expense tool
  server.tool(
    "addExpense",
    {
      amount: z.number().positive().describe("Expense amount"),
      description: z.string().min(1).describe("Expense description"),
      category: z.string().min(1).describe("Expense category"),
      date: z.string().optional().describe("Expense date (ISO string, defaults to current date)"),
      currency: z.string().default("USD").describe("Currency code"),
      tags: z.array(z.string()).optional().describe("Array of tags"),
      paymentMethod: z.string().optional().describe("Payment method used"),
      receipt: z.string().optional().describe("Receipt URL or reference"),
    },
    async ({ amount, description, category, date, currency, tags, paymentMethod, receipt }) => {
      try {
        const expenseDate = date || new Date().toISOString();
        
        const [newExpense] = await db.insert(schema.expenses).values({
          amount,
          description,
          category,
          date: expenseDate,
          currency: currency || "USD",
          tags: tags || [],
          paymentMethod,
          receipt,
        }).returning();

        return {
          content: [
            {
              type: "text",
              text: `Expense added successfully: ${JSON.stringify(newExpense, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error adding expense: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get expenses tool
  server.tool(
    "getExpenses",
    {
      category: z.string().optional().describe("Filter by category"),
      startDate: z.string().optional().describe("Filter from date (ISO string)"),
      endDate: z.string().optional().describe("Filter to date (ISO string)"),
      tags: z.array(z.string()).optional().describe("Filter by tags"),
      limit: z.number().default(50).describe("Limit results"),
      offset: z.number().default(0).describe("Pagination offset"),
    },
    async ({ category, startDate, endDate, tags, limit, offset }) => {
      try {
        const conditions = [];
        
        if (category) {
          conditions.push(eq(schema.expenses.category, category));
        }
        
        if (startDate) {
          conditions.push(gte(schema.expenses.date, startDate));
        }
        
        if (endDate) {
          conditions.push(lte(schema.expenses.date, endDate));
        }

        let query = db.select().from(schema.expenses);
        
        if (conditions.length > 0) {
          query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
        }
        
        const expenses = await query
          .orderBy(desc(schema.expenses.date))
          .limit(limit)
          .offset(offset);

        // Filter by tags if provided
        let filteredExpenses = expenses;
        if (tags && tags.length > 0) {
          filteredExpenses = expenses.filter((expense: any) => {
            if (!expense.tags || !Array.isArray(expense.tags)) {
              return false;
            }
            return tags.some((tag: string) => expense.tags.includes(tag));
          });
        }

        return {
          content: [
            {
              type: "text",
              text: `Found ${filteredExpenses.length} expenses:\n${JSON.stringify(filteredExpenses, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving expenses: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Update expense tool
  server.tool(
    "updateExpense",
    {
      id: z.number().describe("Expense ID"),
      amount: z.number().positive().optional().describe("Expense amount"),
      description: z.string().min(1).optional().describe("Expense description"),
      category: z.string().min(1).optional().describe("Expense category"),
      date: z.string().optional().describe("Expense date (ISO string)"),
      currency: z.string().optional().describe("Currency code"),
      tags: z.array(z.string()).optional().describe("Array of tags"),
      paymentMethod: z.string().optional().describe("Payment method used"),
      receipt: z.string().optional().describe("Receipt URL or reference"),
    },
    async ({ id, amount, description, category, date, currency, tags, paymentMethod, receipt }) => {
      try {
        const updateData: any = {};
        
        if (amount !== undefined) updateData.amount = amount;
        if (description !== undefined) updateData.description = description;
        if (category !== undefined) updateData.category = category;
        if (date !== undefined) updateData.date = date;
        if (currency !== undefined) updateData.currency = currency;
        if (tags !== undefined) updateData.tags = tags;
        if (paymentMethod !== undefined) updateData.paymentMethod = paymentMethod;
        if (receipt !== undefined) updateData.receipt = receipt;

        if (Object.keys(updateData).length === 0) {
          return {
            content: [
              {
                type: "text",
                text: "No fields provided to update",
              },
            ],
            isError: true,
          };
        }

        const [updatedExpense] = await db.update(schema.expenses)
          .set(updateData)
          .where(eq(schema.expenses.id, id))
          .returning();

        if (!updatedExpense) {
          return {
            content: [
              {
                type: "text",
                text: `Expense with ID ${id} not found`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Expense updated successfully: ${JSON.stringify(updatedExpense, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error updating expense: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Delete expense tool
  server.tool(
    "deleteExpense",
    {
      id: z.number().describe("Expense ID to delete"),
    },
    async ({ id }) => {
      try {
        const [deletedExpense] = await db.delete(schema.expenses)
          .where(eq(schema.expenses.id, id))
          .returning();

        if (!deletedExpense) {
          return {
            content: [
              {
                type: "text",
                text: `Expense with ID ${id} not found`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text",
              text: `Expense deleted successfully: ${JSON.stringify(deletedExpense, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error deleting expense: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get expense summary tool
  server.tool(
    "getExpenseSummary",
    {
      startDate: z.string().optional().describe("Summary from date (ISO string)"),
      endDate: z.string().optional().describe("Summary to date (ISO string)"),
      groupBy: z.enum(["category", "month", "paymentMethod"]).optional().describe("Group by field"),
      currency: z.string().optional().describe("Filter by currency"),
    },
    async ({ startDate, endDate, groupBy, currency }) => {
      try {
        const conditions = [];
        
        if (startDate) {
          conditions.push(gte(schema.expenses.date, startDate));
        }
        
        if (endDate) {
          conditions.push(lte(schema.expenses.date, endDate));
        }
        
        if (currency) {
          conditions.push(eq(schema.expenses.currency, currency));
        }

        let query = db.select().from(schema.expenses);
        
        if (conditions.length > 0) {
          query = query.where(conditions.length === 1 ? conditions[0] : and(...conditions));
        }
        
        const expenses = await query;

        // Calculate total
        const total = expenses.reduce((sum: number, expense: any) => sum + expense.amount, 0);
        
        // Group by if specified
        let groupedData = {};
        if (groupBy) {
          groupedData = expenses.reduce((acc: any, expense: any) => {
            let key: string;
            
            if (groupBy === "category") {
              key = expense.category;
            } else if (groupBy === "month") {
              key = expense.date.substring(0, 7); // YYYY-MM
            } else if (groupBy === "paymentMethod") {
              key = expense.paymentMethod || "Unknown";
            } else {
              key = "Other";
            }
            
            if (!acc[key]) {
              acc[key] = { total: 0, count: 0 };
            }
            acc[key].total += expense.amount;
            acc[key].count += 1;
            
            return acc;
          }, {});
        }

        const summary = {
          totalExpenses: expenses.length,
          totalAmount: total,
          averageAmount: expenses.length > 0 ? total / expenses.length : 0,
          currency: currency || "Mixed",
          dateRange: {
            from: startDate || "All time",
            to: endDate || "All time"
          },
          ...(groupBy && { groupedBy: groupBy, groups: groupedData })
        };

        return {
          content: [
            {
              type: "text",
              text: `Expense Summary:\n${JSON.stringify(summary, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error generating expense summary: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  // Get expense categories tool
  server.tool(
    "getExpenseCategories",
    {},
    async () => {
      try {
        const categories = await db.select().from(schema.categories);
        
        // Also get unique categories from expenses table
        const expenseCategories = await db.select({
          category: schema.expenses.category
        }).from(schema.expenses).groupBy(schema.expenses.category);

        const allCategories = [
          ...categories.map((cat: any) => ({ name: cat.name, description: cat.description, source: "categories_table" })),
          ...expenseCategories.map((cat: any) => ({ name: cat.category, description: null, source: "expenses_table" }))
        ];

        // Remove duplicates
        const uniqueCategories = allCategories.filter((cat, index, self) => 
          index === self.findIndex(c => c.name === cat.name)
        );

        return {
          content: [
            {
              type: "text",
              text: `Available Categories:\n${JSON.stringify(uniqueCategories, null, 2)}`,
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text",
              text: `Error retrieving categories: ${error instanceof Error ? error.message : "Unknown error"}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

app.get("/", (c) => {
  return c.text("Expenses Tracking MCP Server");
});

// MCP endpoint - handles JSON-RPC requests over HTTP
app.all("/mcp", async (c) => {
  const db = drizzle(c.env.DB);
  const mcpServer = createMcpServer(db);
  const transport = new StreamableHTTPTransport();
  
  await mcpServer.connect(transport);
  return transport.handleRequest(c);
});

// SSE endpoint for MCP clients that expect Server-Sent Events
app.get("/sse", (c) => {
  return streamSSE(c, async (stream) => {
    // Send initial connection message
    await stream.writeSSE({
      data: JSON.stringify({
        jsonrpc: "2.0",
        method: "server/initialized",
        params: {
          protocolVersion: "2024-11-05",
          capabilities: {
            tools: {},
            resources: {},
            prompts: {}
          },
          serverInfo: {
            name: "expenses-tracker",
            version: "1.0.0"
          }
        }
      }),
      event: "message",
      id: "init"
    });

    // Keep connection alive
    const keepAlive = setInterval(async () => {
      try {
        await stream.writeSSE({
          data: JSON.stringify({ type: "ping", timestamp: Date.now() }),
          event: "ping"
        });
      } catch (error) {
        clearInterval(keepAlive);
      }
    }, 30000);

    // Handle client disconnect
    c.req.raw.signal?.addEventListener('abort', () => {
      clearInterval(keepAlive);
    });
  });
});

// REST API endpoints for testing
app.get("/api/expenses", async (c) => {
  const db = drizzle(c.env.DB);
  const expenses = await db.select().from(schema.expenses).orderBy(desc(schema.expenses.date));
  return c.json({ expenses });
});

app.post("/api/expenses", async (c) => {
  const db = drizzle(c.env.DB);
  const data = await c.req.json();
  
  try {
    const validatedData = addExpenseSchema.parse(data);
    const expenseDate = validatedData.date || new Date().toISOString();
    
    const [newExpense] = await db.insert(schema.expenses).values({
      ...validatedData,
      date: expenseDate,
      tags: validatedData.tags || [],
    }).returning();

    return c.json({ expense: newExpense }, 201);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to create expense" }, 500);
  }
});

app.get("/api/expenses/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number.parseInt(c.req.param("id"));
  
  const [expense] = await db.select()
    .from(schema.expenses)
    .where(eq(schema.expenses.id, id));
  
  if (!expense) {
    return c.json({ error: "Expense not found" }, 404);
  }
  
  return c.json({ expense });
});

app.put("/api/expenses/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number.parseInt(c.req.param("id"));
  const data = await c.req.json();
  
  try {
    const validatedData = updateExpenseSchema.parse({ ...data, id });
    const { id: _, ...updateData } = validatedData;
    
    const [updatedExpense] = await db.update(schema.expenses)
      .set(updateData)
      .where(eq(schema.expenses.id, id))
      .returning();
    
    if (!updatedExpense) {
      return c.json({ error: "Expense not found" }, 404);
    }
    
    return c.json({ expense: updatedExpense });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return c.json({ error: "Validation error", details: error.errors }, 400);
    }
    return c.json({ error: "Failed to update expense" }, 500);
  }
});

app.delete("/api/expenses/:id", async (c) => {
  const db = drizzle(c.env.DB);
  const id = Number.parseInt(c.req.param("id"));
  
  const [deletedExpense] = await db.delete(schema.expenses)
    .where(eq(schema.expenses.id, id))
    .returning();
  
  if (!deletedExpense) {
    return c.json({ error: "Expense not found" }, 404);
  }
  
  return c.json({ message: "Expense deleted successfully" });
});

app.get("/api/categories", async (c) => {
  const db = drizzle(c.env.DB);
  const categories = await db.select().from(schema.categories);
  return c.json({ categories });
});

app.post("/api/categories", async (c) => {
  const db = drizzle(c.env.DB);
  const { name, description } = await c.req.json();
  
  if (!name) {
    return c.json({ error: "Category name is required" }, 400);
  }
  
  try {
    const [newCategory] = await db.insert(schema.categories).values({
      name,
      description,
    }).returning();
    
    return c.json({ category: newCategory }, 201);
  } catch (error) {
    return c.json({ error: "Failed to create category" }, 500);
  }
});

app.get("/openapi.json", c => {
  return c.json(createOpenAPISpec(app, {
    info: {
      title: "Expenses Tracking MCP Server",
      version: "1.0.0",
      description: "MCP server for tracking and managing expenses with AI agents",
    },
  }))
});

app.use("/fp/*", createFiberplane({
  app,
  openapi: { url: "/openapi.json" }
}));

export default app;