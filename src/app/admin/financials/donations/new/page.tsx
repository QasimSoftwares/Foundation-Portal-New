"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { fetchWithCSRF } from "@/lib/http/csrf-interceptor";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

type Category = { donation_category_id: string; donation_category_name: string; is_active: boolean };
type Project = { project_id: string; project_name: string; donation_category_id: string; is_active: boolean };

const donationSchema = z.object({
  donor_number: z.string().min(1, "Donor number is required"),
  amount: z.coerce.number().min(0.01, "Amount must be greater than 0"),
  currency: z.enum(["PKR" as const], { required_error: "Currency is required" }),
  category_name: z.string().min(1, "Category name is required").optional().transform((v) => v || ""),
  project_name: z.string().min(1, "Project name is required").optional().transform((v) => v || ""),
  mode_of_payment: z.enum(["Online", "BankTransfer", "CreditCard"], { required_error: "Mode of payment is required" }),
  donation_type: z.enum(["Zakat", "Sadqa", "General"], { required_error: "Donation type is required" }),
  donation_date: z.string().min(1, "Donation date is required"),
  transaction_id: z.string().optional(),
});

type DonationFormData = z.infer<typeof donationSchema>;

export default function NewDonationPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<Array<{ donor_id: string; donor_number: string; full_name: string | null; phone_number: string | null; address: string | null }>>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [selectedDonor, setSelectedDonor] = useState<{ donor_id: string; donor_number: string; full_name: string | null; phone_number: string | null; address: string | null } | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>("");

  const { register, handleSubmit, formState: { errors }, setValue, watch } = useForm<DonationFormData>({
    resolver: zodResolver(donationSchema),
    defaultValues: {
      currency: "PKR",
      mode_of_payment: "Online",
      donation_type: "General",
      donation_date: new Date().toISOString().slice(0, 10),
    },
  });

  // Debounced search effect
  useEffect(() => {
    let active = true;
    const q = search.trim();
    if (q.length < 2) {
      setResults([]);
      return;
    }
    setIsSearching(true);
    const timer = setTimeout(async () => {
      try {
        const res = await fetch(`/api/admin/financials/donors/search?q=${encodeURIComponent(q)}`, {
          method: 'GET',
          credentials: 'include',
          headers: { 'Cache-Control': 'no-cache' },
        });
        const data = await res.json().catch(() => ({ results: [] }));
        if (!active) return;
        setResults(Array.isArray(data?.results) ? data.results : []);
      } catch (e) {
        if (!active) return;
        setResults([]);
      } finally {
        if (active) setIsSearching(false);
      }
    }, 300);
    return () => { active = false; clearTimeout(timer); };
  }, [search]);

  // Watch for category changes to filter projects
  const watchedCategoryName = watch("category_name");

  useEffect(() => {
    const loadData = async () => {
      try {
        const [catsRes, projsRes] = await Promise.all([
          fetch("/api/admin/programs/categories", { credentials: "include" }),
          fetch("/api/admin/programs/projects", { credentials: "include" }),
        ]);
        const catsData = await catsRes.json();
        const projsData = await projsRes.json();
        setCategories((catsData.items || []).filter((c: Category) => c.is_active));
        setProjects((projsData.items || []).filter((p: Project) => p.is_active));
      } catch (e) {
        toast.error("Failed to load categories and projects");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, []);

  // Filtered projects based on selected category
  const filteredProjects = useMemo(() => {
    if (!watchedCategoryName) return [];
    // Need to find the category by name and then filter projects
    const category = categories.find(c => c.donation_category_name === watchedCategoryName);
    if (!category) return [];
    return projects.filter(p => p.donation_category_id === category.donation_category_id);
  }, [watchedCategoryName, projects, categories]);

  console.log("NewDonationPage component rendered");

  const onSubmit = async (values: DonationFormData) => {
    console.log("Form submitted with values:", values);
    console.log("Form errors:", errors);
    console.log("Form is valid:", Object.keys(errors).length === 0);
    setIsSubmitting(true);
    const t = toast.loading("Creating donation request...");
    console.log("Starting API call...");
    try {
      const res = await fetchWithCSRF("/api/admin/financials/donation-requests/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(values),
      });
      console.log("API response status:", res.status);
      const data = await res.json().catch(() => ({}));
      console.log("API response data:", data);
      if (!res.ok) {
        throw new Error(data?.error || "Failed to create donation request");
      }

      toast.success("Donation request created", { id: t });
      router.push("/admin/financials/donations");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unexpected error";
      console.error("Submission error:", msg);
      toast.error(msg, { id: t });
    } finally {
      setIsSubmitting(false);
      console.log("Submission completed");
    }
  };

  return (
    <div className="space-y-6 pt-2">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-gray-900">New Donation</h1>
          <p className="mt-1 text-sm text-gray-600">Enter donation details (creates a pending donation request)</p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>Back</Button>
      </div>

      {/* Donor Search */}
      <section className="rounded-lg border border-gray-200 p-4">
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Select Donor</h2>
        <div className="grid gap-3">
          <div>
            <Label htmlFor="donor_search">Search by name, phone, or donor number/ID</Label>
            <Input
              id="donor_search"
              placeholder="Type at least 2 characters..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <p className="mt-1 text-xs text-gray-500">Results show donor and linked profile info.</p>
          </div>

          {/* Results list */}
          {search.trim().length >= 2 && (
            <div className="rounded-md border divide-y">
              {isSearching && results.length === 0 && (
                <div className="p-3 text-sm text-gray-600">Searching...</div>
              )}
              {!isSearching && results.length === 0 && (
                <div className="p-3 text-sm text-gray-600">No donors found.</div>
              )}
              {results.map((r) => (
                <button
                  key={r.donor_id}
                  type="button"
                  onClick={() => {
                    setSelectedDonor(r);
                    // Populate form field
                    setValue("donor_number", r.donor_number);
                  }}
                  className={`w-full text-left p-3 hover:bg-gray-50 ${selectedDonor?.donor_id === r.donor_id ? 'bg-blue-50' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-medium text-gray-900">{String(r.full_name || 'Unknown Name')}</div>
                      <div className="text-xs text-gray-600">Donor ID: {String(r.donor_number)}</div>
                    </div>
                    <div className="text-sm text-gray-700">{String(r.phone_number || 'N/A')}</div>
                  </div>
                  {r.address && <div className="text-xs text-gray-600 mt-1">{String(r.address)}</div>}
                </button>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Donation Form */}
      <section className="rounded-lg border border-gray-200 p-6 bg-gray-50">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Donation Details</h2>

        {/* Selected Donor Summary */}
        {selectedDonor && (
          <div className="mb-6 p-4 bg-white rounded-lg border">
            <h3 className="text-md font-medium text-gray-900 mb-3">Selected Donor</h3>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div>
                <Label>Donor Name</Label>
                <Input value={String(selectedDonor.full_name || '')} readOnly />
              </div>
              <div>
                <Label>Phone Number</Label>
                <Input value={String(selectedDonor.phone_number || '')} readOnly />
              </div>
              <div className="md:col-span-1">
                <Label>Donor ID</Label>
                <Input value={String(selectedDonor.donor_number)} readOnly />
              </div>
              <div className="md:col-span-3">
                <Label>Address</Label>
                <Input value={String(selectedDonor.address || '')} readOnly />
              </div>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit(onSubmit)} className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <Label htmlFor="amount">Amount</Label>
            <Input id="amount" type="number" step="0.01" placeholder="0.00" {...register("amount")} />
            {errors.amount && <p className="mt-1 text-sm text-red-600">{errors.amount.message}</p>}
          </div>

          <div>
            <Label htmlFor="currency">Currency</Label>
            <select id="currency" className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-2" {...register("currency")}>
              <option value="PKR">PKR</option>
            </select>
            {errors.currency && <p className="mt-1 text-sm text-red-600">{errors.currency.message}</p>}
          </div>

          <div>
            <Label htmlFor="mode_of_payment">Mode of Payment</Label>
            <select id="mode_of_payment" className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-2" {...register("mode_of_payment")}>
              <option value="Online">Online</option>
              <option value="BankTransfer">Bank Transfer</option>
              <option value="CreditCard">Credit Card</option>
            </select>
            {errors.mode_of_payment && <p className="mt-1 text-sm text-red-600">{errors.mode_of_payment.message}</p>}
          </div>

          <div>
            <Label htmlFor="donation_type">Donation Type</Label>
            <select id="donation_type" className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-2" {...register("donation_type")}>
              <option value="Zakat">Zakat</option>
              <option value="Sadqa">Sadqa</option>
              <option value="General">General</option>
            </select>
            {errors.donation_type && <p className="mt-1 text-sm text-red-600">{errors.donation_type.message}</p>}
          </div>

          <div>
            <Label htmlFor="donation_date">Donation Date</Label>
            <Input id="donation_date" type="date" {...register("donation_date")} />
            {errors.donation_date && <p className="mt-1 text-sm text-red-600">{errors.donation_date.message}</p>}
          </div>

          <div>
            <Label htmlFor="transaction_id">Transaction ID (Optional)</Label>
            <Input 
              id="transaction_id" 
              placeholder="e.g., bank reference number" 
              {...register("transaction_id")} 
            />
            <p className="mt-1 text-xs text-gray-500">Enter the bank or payment reference number if available</p>
            {errors.transaction_id && <p className="mt-1 text-sm text-red-600">{errors.transaction_id.message}</p>}
          </div>

          <div>
            <Label htmlFor="category_id">Category</Label>
            <select
              id="category_id"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-2"
              {...register("category_name")}
              onChange={(e) => {
                setValue("category_name", e.target.value);
              }}
            >
              <option value="" disabled>Select a category</option>
              {categories.map((c) => (
                <option key={c.donation_category_id} value={c.donation_category_name}>
                  {c.donation_category_name}
                </option>
              ))}
            </select>
            {errors.category_name && <p className="mt-1 text-sm text-red-600">{errors.category_name.message}</p>}
          </div>

          <div>
            <Label htmlFor="project_id">Project</Label>
            <select
              id="project_id"
              className="mt-2 block w-full rounded-md border border-gray-300 bg-white p-2"
              {...register("project_name")}
              disabled={!watchedCategoryName}
            >
              <option value="" disabled>{watchedCategoryName ? "Select a project" : "Select a category first"}</option>
              {filteredProjects.map((p) => (
                <option key={p.project_id} value={p.project_name}>
                  {p.project_name}
                </option>
              ))}
            </select>
            {errors.project_name && <p className="mt-1 text-sm text-red-600">{errors.project_name.message}</p>}
          </div>

          <div className="md:col-span-2 flex justify-end gap-3">
            <Button type="button" variant="outline" onClick={() => router.push("/admin/financials/donations")}>Cancel</Button>
            <Button
              type="submit"
              disabled={isSubmitting}
              onClick={() => {
                console.log("Button clicked");
                console.log("Form errors:", errors);
                console.log("Form is valid:", Object.keys(errors).length === 0);
                if (Object.keys(errors).length === 0) {
                  console.log("Form is valid, submitting...");
                  handleSubmit(onSubmit)();
                } else {
                  console.log("Form is invalid, not submitting");
                }
              }}
            >
              {isSubmitting ? "Submitting..." : "Create Donation Request"}
            </Button>
          </div>
        </form>
      </section>
    </div>
  );
}
