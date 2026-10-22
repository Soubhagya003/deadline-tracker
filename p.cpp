#include<bits/stdc++.h>
using namespace std;

#define ll long long
#define takei(n) ll n;cin>>n;
#define takes(s) string s;cin>>s;
#define takec(c) char c;cin>>c;
#define yes cout<<"YES\n"
#define no cout<<"NO\n"
#define line cout<<'\n'
#define fline cout<<endl
#define tot(v) v.begin(),v.end()
#define totrev(v) v.rbegin(),v.rend()
#define incsort(v) sort(tot(v));
#define decsort(v) sort(totrev(v));
#define ff first
#define ss second
#define si size()
#define pb push_back
#define pf push_front
#define ppb pop_back
#define ppf pop_front
#define f(i,a,b) for(ll i=a;i<b;i++)

#define rt return
#define sp cout<<" "
#define op(x) cout<<x<<" "
#define opp(x) cout<<x<<endl
#define vi(v,x,n) vector<x> v(n)
#define vvi(v,x,n,m) vector<vector<x>> v(n,vector<x>(m))
typedef pair<ll,ll> pll;
typedef vector<ll> vl;
typedef vector<bool> vb;
typedef vector<vl> vvl;
typedef vector<vb> vvb;
typedef vector<pll> vpl;

const ll N=1000010;
const ll mod=1000000007;

// vector<bool> isprime(N,true);
// vector<ll> primes;
// vector<ll> lp(N,0),hp(N,0);

// void check_prime(){
//     isprime[0]=isprime[1]=false;
//     f(i,2,N){
//         if(isprime[i]){
//             primes.push_back(i);
//             lp[i]=hp[i]=i;
//             for(ll j=2*i;j<N;j+=i){
//                 isprime[j]=false;
//                 hp[j]=i;
//                 if(lp[j]==0) lp[j]=i;
//             }
//         }
//     }
// }

ll ceil(ll n, ll k){
    if(n%k==0) {
        return n/k;
    }
    else return (n/k)+1;
}

vector<ll> fact;
void calcFact(ll n){
    fact.resize(n+1);
    fact[0]=1;
    for(ll i=1;i<=n;i++){
        fact[i]= (fact[i-1]*i)%mod;
    }
}

ll nCr(ll n, ll r){
    if(r>n) return 0;
    if(r>n-r) r=n-r;

    ll ans=1;
    for(ll i=1;i<=r;i++){
        ans*=(n-r+1);
        ans/=i;
    }
    return ans;
}

ll binmultiply(ll a, ll b){
    ll ans=0;
    while(b>0){
        if(b&1){
            if(LLONG_MAX-ans<a) {
                return LLONG_MAX;
            }
            ans+=a;
        }
        if(LLONG_MAX-a<a) {
            return LLONG_MAX;
        }
        a+=a;
        b>>=1;
    }
    return ans;
}

ll binexp(ll a, ll b){
    ll ans=1;
    while(b>0){
        if(b&1){
            ans=binmultiply(ans,a);
        }
        a=binmultiply(a,a);
        b>>=1;
    }
    return ans;
}

ll mmi(ll a, ll m){
    ll ans=1;
    ll b=mod-2;
    while(b>0){
        if(b&1){
            ans=(ans*a)%m;
        }
        a=(a*a)%m;
        b>>=1;
    }
    return ans;
}

struct custom_hash {
    static uint64_t splitmix64(uint64_t x) {
        // from https://xorshift.di.unimi.it/splitmix64.c
        x += 0x9e3779b97f4a7c15;
        x = (x ^ (x >> 30)) * 0xbf58476d1ce4e5b9;
        x = (x ^ (x >> 27)) * 0x94d049bb133111eb;
        return x ^ (x >> 31);
    }
    
    size_t operator()(uint64_t x) const {
        static const uint64_t FIXED_RANDOM = chrono::steady_clock::now().time_since_epoch().count();
        return splitmix64(x + FIXED_RANDOM);
    }
};

void flush(){
    ios_base::sync_with_stdio(false);
    cin.tie(NULL);
}

ll calc(ll i, ll j){
        if(j<i) rt 0;
        ll n=j-i+1;
        rt (n*(n+1))/2;
    }

int main(){
    flush();
    vl nums={1,2,1};
    ll goal=4,k=1;
    ll ans=0,lo=1,hi=1,n=nums.si;
    vl v(n+1,0);
    f(i,1,n+1) v[i]=nums[i-1]+v[i-1];
    // for(auto x:v) opp(x);
    n++;
    while(hi<n){
        while(hi<n && abs(v[hi]-v[lo-1]-goal)<k){
            ans+=(calc(lo,hi)-calc(lo,hi-1));
            hi++;
        }
        while(hi<n && lo<hi && abs(v[hi]-v[lo-1]-goal)>=k){
            lo++;
        }
    }
    opp(calc(1,nums.si)-ans);
    return 0;
}
