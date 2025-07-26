
import { RegistrationFormData, UserData, ProfileData, UserCategory, DocumentType, LibraryDocument, ConsultancyCase, ConsultancyStatus, PaymentRecord, UserCategoryInfo } from './types';
import { INITIAL_LIBRARY_DATA, USER_CATEGORIES } from './constants';

// --- MOCK DATABASE ---
let DB_USERS: UserData[] = [];
let DB_DOCUMENTS: LibraryDocument[] = [...INITIAL_LIBRARY_DATA];
let DB_CASES: ConsultancyCase[] = [];

// Helper to simulate network delay
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

// Helper to find category info
const getCategoryInfo = (category: UserCategory): UserCategoryInfo => {
    const info = USER_CATEGORIES.find(c => c.value === category);
    if (!info) throw new Error("Invalid user category");
    return info;
}

// --- API CLIENT IMPLEMENTATION ---
export const apiClient = {
    // === AUTH ===
    async login(email: string, pass: string): Promise<UserData> {
        await sleep(500);
        const user = DB_USERS.find(u => u.email === email && u.password === pass);
        if (user) {
            localStorage.setItem('authToken', `${user.email}|${user.password}`);
            return user;
        }
        throw new Error("Invalid credentials");
    },
    async logout(): Promise<void> {
        await sleep(200);
        localStorage.removeItem('authToken');
    },
    async getMe(): Promise<UserData | null> {
        await sleep(300);
        const token = localStorage.getItem('authToken');
        if (!token) return null;
        const [email, password] = token.split('|');
        const user = DB_USERS.find(u => u.email === email && u.password === password);
        return user || null;
    },
    async register(data: RegistrationFormData & { category: UserCategory }, paymentResponse: any): Promise<UserData> {
        await sleep(500);
        if (DB_USERS.find(u => u.email === data.email)) {
            throw new Error("User already exists");
        }
        const categoryInfo = getCategoryInfo(data.category);
        const paymentRecord: PaymentRecord = {
            id: paymentResponse.razorpay_payment_id,
            date: new Date().toISOString(),
            description: `Registration Fee for ${categoryInfo.label}`,
            amount: categoryInfo.price,
            paymentId: paymentResponse.razorpay_payment_id
        };
        const newUser: UserData = {
            ...data,
            // These will be filled in the profile step
            address: '', bio: '', profilePicture: null, hasActiveSubscription: false,
            payments: [paymentRecord],
            bookmarkedDocIds: [],
        };
        // In a real app, only partial data would be stored until profile completion
        DB_USERS.push(newUser);
        return newUser;
    },
    async completeProfile(data: ProfileData & { email: string }): Promise<UserData> {
        await sleep(500);
        const userIndex = DB_USERS.findIndex(u => u.email === data.email);
        if (userIndex === -1) throw new Error("User not found");
        DB_USERS[userIndex] = { ...DB_USERS[userIndex], ...data };
        localStorage.setItem('authToken', `${DB_USERS[userIndex].email}|${DB_USERS[userIndex].password}`);
        return DB_USERS[userIndex];
    },

    // === USER MANAGEMENT ===
    async updateProfile(data: Partial<UserData>): Promise<UserData> {
        await sleep(400);
        const me = await this.getMe();
        if (!me) throw new Error("Not authenticated");
        const userIndex = DB_USERS.findIndex(u => u.email === me.email);
        DB_USERS[userIndex] = { ...DB_USERS[userIndex], ...data };
        return DB_USERS[userIndex];
    },
    async changePassword(oldPass: string, newPass: string): Promise<UserData> {
        await sleep(400);
        const me = await this.getMe();
        if (!me || me.password !== oldPass) throw new Error("Authentication failed");
        const userIndex = DB_USERS.findIndex(u => u.email === me.email);
        DB_USERS[userIndex].password = newPass;
        localStorage.setItem('authToken', `${me.email}|${newPass}`);
        return DB_USERS[userIndex];
    },
    async getAllUsers(): Promise<UserData[]> {
        await sleep(600);
        // This is an admin function, in a real app it would check for admin role.
        return DB_USERS;
    },

    // === LIBRARY / DOCUMENTS ===
    async getDocuments(type?: DocumentType): Promise<LibraryDocument[]> {
        await sleep(500);
        if (type) {
            return DB_DOCUMENTS.filter(doc => doc.type === type);
        }
        return DB_DOCUMENTS;
    },
    async addDocument(doc: Omit<LibraryDocument, 'id'>): Promise<LibraryDocument> {
        await sleep(400);
        const newDoc = { ...doc, id: `doc-${Date.now()}`};
        DB_DOCUMENTS.unshift(newDoc);
        return newDoc;
    },
    async updateDocument(doc: LibraryDocument): Promise<LibraryDocument> {
        await sleep(400);
        const index = DB_DOCUMENTS.findIndex(d => d.id === doc.id);
        if (index === -1) throw new Error("Document not found");
        DB_DOCUMENTS[index] = doc;
        return doc;
    },
    async deleteDocument(docId: string): Promise<void> {
        await sleep(400);
        DB_DOCUMENTS = DB_DOCUMENTS.filter(d => d.id !== docId);
    },
    async toggleBookmark(docId: string): Promise<UserData> {
        await sleep(200);
        const me = await this.getMe();
        if (!me) throw new Error("Not authenticated");
        
        const userIndex = DB_USERS.findIndex(u => u.email === me.email);
        const currentBookmarks = DB_USERS[userIndex].bookmarkedDocIds || [];
        const isBookmarked = currentBookmarks.includes(docId);
        
        if (isBookmarked) {
            DB_USERS[userIndex].bookmarkedDocIds = currentBookmarks.filter(id => id !== docId);
        } else {
            DB_USERS[userIndex].bookmarkedDocIds = [...currentBookmarks, docId];
        }
        return DB_USERS[userIndex];
    },
    
    // === PAYMENTS / SUBSCRIPTIONS ===
    async subscribeToLibrary(email: string): Promise<UserData> {
        await sleep(1000);
        const userIndex = DB_USERS.findIndex(u => u.email === email);
        if (userIndex === -1) throw new Error("User not found");
        
        const user = DB_USERS[userIndex];
        const categoryInfo = getCategoryInfo(user.category);
        const paymentId = `rzp_sub_${Date.now()}`;

        const paymentRecord: PaymentRecord = {
            id: paymentId,
            date: new Date().toISOString(),
            description: 'Annual Library Subscription',
            amount: categoryInfo.subscriptionPrice,
            paymentId: paymentId
        };
        
        user.hasActiveSubscription = true;
        user.payments.push(paymentRecord);
        DB_USERS[userIndex] = user;
        return user;
    },

    // === CONSULTANCY ===
    async getConsultancyCases(isAdmin: boolean = false): Promise<ConsultancyCase[]> {
        await sleep(600);
        if (isAdmin) {
            return DB_CASES.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
        }
        const me = await this.getMe();
        if (!me) throw new Error("Not authenticated");
        return DB_CASES.filter(c => c.userEmail === me.email).sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime());
    },
    async submitConsultancyCase(data: { issue: string; documentUrl: string | null; documentName: string | null }): Promise<ConsultancyCase> {
        await sleep(500);
        const me = await this.getMe();
        if (!me) throw new Error("Not authenticated");
        const newCase: ConsultancyCase = {
            id: `CASE-${Date.now().toString().slice(-6)}`,
            date: new Date().toISOString(),
            issue: data.issue,
            documentUrl: data.documentUrl,
            documentName: data.documentName,
            status: ConsultancyStatus.PENDING,
            isPaid: false,
            userName: me.name,
            userEmail: me.email,
        };
        DB_CASES.unshift(newCase);
        return newCase;
    },
    async updateConsultancyCase(data: { caseId: string, solution: string, fee: number, solutionDocumentUrl: string | null, solutionDocumentName: string | null }): Promise<ConsultancyCase> {
        await sleep(500);
        const caseIndex = DB_CASES.findIndex(c => c.id === data.caseId);
        if (caseIndex === -1) throw new Error("Case not found");
        DB_CASES[caseIndex] = {
            ...DB_CASES[caseIndex],
            solution: data.solution,
            fee: data.fee,
            solutionDocumentUrl: data.solutionDocumentUrl,
            solutionDocumentName: data.solutionDocumentName,
            status: ConsultancyStatus.SOLUTION_READY,
        };
        return DB_CASES[caseIndex];
    },
    async payForCase(caseId: string, fee: number): Promise<{ updatedCase: ConsultancyCase, updatedUser: UserData }> {
        await sleep(1000);
        const me = await this.getMe();
        if (!me) throw new Error("Not authenticated");
        
        const caseIndex = DB_CASES.findIndex(c => c.id === caseId);
        if (caseIndex === -1) throw new Error("Case not found");
        
        const userIndex = DB_USERS.findIndex(u => u.email === me.email);
        if (userIndex === -1) throw new Error("User not found");

        const paymentId = `rzp_case_${Date.now()}`;
        const paymentRecord: PaymentRecord = {
            id: paymentId,
            date: new Date().toISOString(),
            description: `Consultancy Fee for Case #${caseId}`,
            amount: fee,
            paymentId
        };
        
        DB_USERS[userIndex].payments.push(paymentRecord);
        DB_CASES[caseIndex].isPaid = true;
        DB_CASES[caseIndex].status = ConsultancyStatus.COMPLETED;
        
        return { updatedCase: DB_CASES[caseIndex], updatedUser: DB_USERS[userIndex] };
    },

    // === FILE UPLOADS (S3 SIMULATION) ===
    async uploadFile(file: File): Promise<string> {
        await sleep(1000);
        console.log(`Simulating upload for ${file.name}...`);
        // In a real app, this would get a pre-signed URL and upload to S3.
        // Here, we just return a fake URL.
        const fakeUrl = `/uploads/mock-${Date.now()}-${file.name}`;
        console.log(`File uploaded to ${fakeUrl}`);
        return fakeUrl;
    },
};
